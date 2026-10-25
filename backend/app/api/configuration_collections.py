"""Member-only intake settings and fresh independent budget projections."""

from datetime import date, datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.adapters.supabase import Supabase
from app.analysis.schemas.models import Category
from app.api.collection_shared import page_response
from app.api.dependencies import Actor, database, enabled
from app.api.responses import CapacityDTO, NeedDTO, Page, QuotaDTO, SlotDTO
from app.domain.errors import DomainError
from app.services.collections import all_rows, member, wire_row

router = APIRouter(prefix="/api/v1/associations", tags=["configuration collections"])
Limit = Annotated[int, Query(ge=1, le=100)]


async def budget_rows(
    table: str, section: str, tenant: UUID, actor: Actor, db: Supabase
) -> list[dict[str, Any]]:
    await member(db, actor, tenant)
    rows = await all_rows(db, actor, table, {"association_id": f"eq.{tenant}"})
    budgets = (await db.command("budget_context", actor.id, {"tenant": str(tenant)}))[
        0
    ][section]
    if not isinstance(budgets, dict):
        raise DomainError("database_unavailable", 503)
    result = []
    for raw in rows:
        row = wire_row(raw)
        key = (
            str(row["id"])
            if table in ("needs", "slots")
            else str(row["category"])
            + ("/" + row["service_date"] if table == "intake_quotas" else "")
        )
        row["computed"] = budgets.get(key, {})
        result.append(row)
    return result


@router.get("/{association_id}/needs", response_model=Page[NeedDTO])
async def needs(
    association_id: UUID,
    request: Request,
    active: bool | None = None,
    category: Category | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await budget_rows("needs", "needs", association_id, actor, db)
    rows = [
        r
        for r in rows
        if (category is None or r["category"] == category)
        and (active is None or r["active"] == active)
    ]
    return page_response(
        rows, request, actor, limit, cursor, {"active": active, "category": category}
    )


@router.get("/{association_id}/capacity", response_model=Page[CapacityDTO])
async def capacity(
    association_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await budget_rows("capacity", "capacity", association_id, actor, db)
    return page_response(
        rows,
        request,
        actor,
        limit,
        cursor,
        keys=("association_id", "category"),
        reverse=False,
    )


@router.get("/{association_id}/intake-quotas", response_model=Page[QuotaDTO])
async def quotas(
    association_id: UUID,
    request: Request,
    from_date: Annotated[date, Query(alias="from")],
    to: date,
    category: Category | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    if not from_date <= to or to - from_date > timedelta(days=31):
        raise DomainError("validation_error", 422)
    rows = await budget_rows("intake_quotas", "quotas", association_id, actor, db)
    rows = [
        r
        for r in rows
        if from_date.isoformat() <= r["service_date"] <= to.isoformat()
        and (category is None or r["category"] == category)
    ]
    return page_response(
        rows,
        request,
        actor,
        limit,
        cursor,
        {"from": from_date.isoformat(), "to": to.isoformat(), "category": category},
        keys=("association_id", "category", "service_date"),
        reverse=False,
    )


@router.get("/{association_id}/slots", response_model=Page[SlotDTO])
async def slots(
    association_id: UUID,
    request: Request,
    from_instant: Annotated[datetime, Query(alias="from")],
    to: datetime,
    active: bool | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    if (
        from_instant.tzinfo is None
        or to.tzinfo is None
        or not from_instant <= to
        or to - from_instant > timedelta(days=31)
    ):
        raise DomainError("validation_error", 422)
    rows = await budget_rows("slots", "slots", association_id, actor, db)
    rows = [
        r
        for r in rows
        if from_instant <= datetime.fromisoformat(r["starts_at"]) <= to
        and (active is None or r["active"] == active)
    ]
    return page_response(
        rows,
        request,
        actor,
        limit,
        cursor,
        {"from": from_instant.isoformat(), "to": to.isoformat(), "active": active},
        keys=("starts_at", "id"),
        reverse=False,
    )
