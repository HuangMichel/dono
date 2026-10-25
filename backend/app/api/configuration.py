"""Association-admin intake configuration with independent budget guards."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Self
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from pydantic import AwareDatetime, Field, model_validator

from app.adapters.supabase import Supabase
from app.analysis.schemas.models import Category, ClosedModel, Season
from app.analysis.validation import normalize_attributes as attributes
from app.api.dependencies import Actor, database, enabled
from app.api.models import Revision
from app.api.responses import CapacityDTO, NeedDTO, QuotaDTO, Single, SlotDTO
from app.domain.errors import DomainError
from app.domain.quantities import validate_quantity as quantity

router = APIRouter(prefix="/api/v1/associations", tags=["configuration"])
PositiveInt = Annotated[int, Field(strict=True, gt=0, le=2147483647)]


class NeedInput(ClosedModel):
    category: Category
    attributes: dict[str, object]
    seasons: list[Season]
    target_quantity: str
    unit: Literal["item"]
    storage_units_per_item: PositiveInt
    active: bool
    source_text: Annotated[str, Field(max_length=2000)] | None = None

    @model_validator(mode="after")
    def validated(self) -> Self:
        self.target_quantity = quantity(self.target_quantity)
        self.attributes = attributes(self.category, self.attributes)
        if len(set(self.seasons)) != len(self.seasons):
            raise ValueError("duplicate seasons")
        return self


class NeedPatch(ClosedModel):
    expected_revision: Revision
    attributes: dict[str, object] | None = None
    seasons: list[Season] | None = None
    target_quantity: str | None = None
    storage_units_per_item: PositiveInt | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def validated(self) -> Self:
        if self.target_quantity is not None:
            self.target_quantity = quantity(self.target_quantity)
        if self.seasons is not None and len(set(self.seasons)) != len(self.seasons):
            raise ValueError("duplicate seasons")
        return self


class CapacityInput(ClosedModel):
    expected_revision: Revision | None = None
    storage_unit: Literal["item_slot"]
    limit_storage_units: Annotated[int, Field(strict=True, ge=0, le=2147483647)]


class QuotaInput(ClosedModel):
    expected_revision: Revision | None = None
    unit: Literal["item"]
    limit_quantity: str

    @model_validator(mode="after")
    def validated(self) -> Self:
        self.limit_quantity = quantity(self.limit_quantity, zero=True)
        return self


class SlotInput(ClosedModel):
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    max_bookings: PositiveInt

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.starts_at >= self.ends_at:
            raise ValueError("invalid interval")
        return self


class SlotPatch(ClosedModel):
    expected_revision: Revision
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    max_bookings: PositiveInt | None = None
    active: bool | None = None


async def configure(
    kind: str,
    tenant: UUID,
    resource: UUID | None,
    category: Category | None,
    day: date | None,
    body: dict[str, object],
    key: UUID,
    actor: Actor,
    db: Supabase,
) -> dict[str, object]:
    outcome = (
        await db.command(
            "config",
            actor.id,
            {
                "key": str(key),
                "kind": kind,
                "tenant": str(tenant),
                "resource": str(resource) if resource else None,
                "category": category,
                "day": day.isoformat() if day else None,
                "body": body,
            },
        )
    )[0]
    table = {
        "need": "needs",
        "slot": "slots",
        "capacity": "capacity",
        "quota": "intake_quotas",
    }[kind]
    params = {"select": "*", "association_id": f"eq.{tenant}"}
    if kind in ("need", "slot"):
        params["id"] = f"eq.{outcome['id']}"
    else:
        params["category"] = f"eq.{category}"
        if day:
            params["service_date"] = f"eq.{day.isoformat()}"
    rows = await db.read(table, actor.token, params)
    if not rows:
        raise DomainError("not_found", 404)
    row = rows[0]
    row["revision"] = str(row["revision"])
    for field in ("limit_quantity", "target_quantity"):
        if field in row:
            row[field] = f"{Decimal(str(row[field])):.3f}"
    budgets = (await db.command("budget_context", actor.id, {"tenant": str(tenant)}))[0]
    section = {
        "need": "needs",
        "slot": "slots",
        "quota": "quotas",
        "capacity": "capacity",
    }[kind]
    entries = budgets[section]
    if not isinstance(entries, dict):
        raise DomainError("database_unavailable", 503)
    lookup = (
        str(row["id"])
        if kind in ("need", "slot")
        else str(category) + ("/" + day.isoformat() if day else "")
    )
    row["computed"] = entries[lookup]
    return row


@router.post("/{association_id}/needs", status_code=201, response_model=Single[NeedDTO])
async def create_need(
    association_id: UUID,
    body: NeedInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await configure(
        "need",
        association_id,
        None,
        None,
        None,
        body.model_dump(mode="json"),
        idempotency_key,
        actor,
        db,
    )
    return {"data": result, "meta": {"request_id": request.state.request_id}}


@router.patch("/{association_id}/needs/{need_id}", response_model=Single[NeedDTO])
async def patch_need(
    association_id: UUID,
    need_id: UUID,
    body: NeedPatch,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    values = body.model_dump(mode="json", exclude_none=True)
    if body.attributes is not None:
        rows = await db.read(
            "needs",
            actor.token,
            {
                "select": "category",
                "id": f"eq.{need_id}",
                "association_id": f"eq.{association_id}",
            },
        )
        if not rows:
            raise DomainError("not_found", 404)
        from typing import cast

        values["attributes"] = attributes(
            cast(Category, rows[0]["category"]), body.attributes
        )
    result = await configure(
        "need", association_id, need_id, None, None, values, idempotency_key, actor, db
    )
    return {"data": result, "meta": {"request_id": request.state.request_id}}


@router.put("/{association_id}/capacity/{category}", response_model=Single[CapacityDTO])
async def set_capacity(
    association_id: UUID,
    category: Category,
    body: CapacityInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await configure(
        "capacity",
        association_id,
        None,
        category,
        None,
        body.model_dump(mode="json", exclude_none=True),
        idempotency_key,
        actor,
        db,
    )
    return {"data": result, "meta": {"request_id": request.state.request_id}}


@router.put(
    "/{association_id}/intake-quotas/{category}/{service_date}",
    response_model=Single[QuotaDTO],
)
async def set_quota(
    association_id: UUID,
    category: Category,
    service_date: date,
    body: QuotaInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await configure(
        "quota",
        association_id,
        None,
        category,
        service_date,
        body.model_dump(mode="json", exclude_none=True),
        idempotency_key,
        actor,
        db,
    )
    return {"data": result, "meta": {"request_id": request.state.request_id}}


@router.post("/{association_id}/slots", status_code=201, response_model=Single[SlotDTO])
async def create_slot(
    association_id: UUID,
    body: SlotInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await configure(
        "slot",
        association_id,
        None,
        None,
        None,
        body.model_dump(mode="json"),
        idempotency_key,
        actor,
        db,
    )
    return {"data": result, "meta": {"request_id": request.state.request_id}}


@router.patch("/{association_id}/slots/{slot_id}", response_model=Single[SlotDTO])
async def patch_slot(
    association_id: UUID,
    slot_id: UUID,
    body: SlotPatch,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await configure(
        "slot",
        association_id,
        slot_id,
        None,
        None,
        body.model_dump(mode="json", exclude_none=True),
        idempotency_key,
        actor,
        db,
    )
    return {"data": result, "meta": {"request_id": request.state.request_id}}
