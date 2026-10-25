"""Registration and audited membership changes, without invitation channels."""

import re
from typing import Annotated, Literal, Self
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, Request
from pydantic import Field, model_validator

from app.adapters.supabase import Supabase
from app.analysis.schemas.models import ClosedModel
from app.api.dependencies import Actor, database, enabled
from app.api.models import Revision, RevisionAction
from app.api.responses import (
    ApprovalDTO,
    AssociationDTO,
    MembershipDTO,
    RecoveryDTO,
    Single,
)
from app.domain.errors import DomainError

router = APIRouter(prefix="/api/v1", tags=["associations"])


class Registration(ClosedModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    rna: str | None = None
    siret: str | None = None
    timezone: str = "Europe/Paris"

    @model_validator(mode="after")
    def valid_identity(self) -> Self:
        self.rna = re.sub(r"\s", "", self.rna).upper() if self.rna else None
        self.siret = re.sub(r"\s", "", self.siret) if self.siret else None
        if (
            not (self.rna or self.siret)
            or (self.rna and not re.fullmatch(r"W\d{9}", self.rna))
            or (self.siret and not re.fullmatch(r"\d{14}", self.siret))
        ):
            raise ValueError("at least one valid normalized RNA/SIRET required")
        try:
            ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("unknown timezone") from exc
        return self


class MemberGrant(ClosedModel):
    profile_id: UUID
    role: Literal["assoc_admin", "assoc_staff"]


class MemberEdit(ClosedModel):
    expected_revision: Revision
    role: Literal["assoc_admin", "assoc_staff"] | None = None
    active: bool | None = None
    reason: Annotated[str, Field(min_length=1, max_length=240)] | None = None


class Recovery(RevisionAction):
    reason: Annotated[str, Field(min_length=1, max_length=240)]


async def command(
    action: str,
    tenant: UUID | None,
    body: dict[str, object],
    key: UUID,
    actor: Actor,
    db: Supabase,
) -> dict[str, object]:
    return (
        await db.command(
            "association",
            actor.id,
            {
                "key": str(key),
                "action": action,
                "tenant": str(tenant) if tenant else None,
                "body": body,
            },
        )
    )[0]


async def association(db: Supabase, actor: Actor, tenant: UUID) -> dict[str, object]:
    rows = await db.read(
        "associations", actor.token, {"select": "*", "id": f"eq.{tenant}"}
    )
    if not rows:
        raise DomainError("not_found", 404)
    rows[0]["revision"] = str(rows[0]["revision"])
    return rows[0]


@router.post("/associations", status_code=201, response_model=Single[AssociationDTO])
async def register(
    body: Registration,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    outcome = await command(
        "create", None, body.model_dump(mode="json"), idempotency_key, actor, db
    )
    return {
        "data": await association(db, actor, UUID(str(outcome["id"]))),
        "meta": {"request_id": request.state.request_id},
    }


@router.get("/associations/{association_id}", response_model=Single[AssociationDTO])
async def read(
    association_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return {
        "data": await association(db, actor, association_id),
        "meta": {"request_id": request.state.request_id},
    }


@router.post(
    "/admin/associations/{association_id}/approval", response_model=Single[ApprovalDTO]
)
async def approve(
    association_id: UUID,
    body: RevisionAction,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await command(
        "approval",
        association_id,
        body.model_dump(mode="json"),
        idempotency_key,
        actor,
        db,
    )
    row = await association(db, actor, association_id)
    # The platform capability grants registration verification only, not roster access.
    from app.services.collections import wire_row

    return {
        "data": {"association": row, "membership": wire_row(result["membership"])},
        "meta": {"request_id": request.state.request_id},
    }


@router.post(
    "/admin/associations/{association_id}/admin-recovery",
    response_model=Single[RecoveryDTO],
)
async def recover(
    association_id: UUID,
    body: Recovery,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await command(
        "recovery",
        association_id,
        body.model_dump(mode="json"),
        idempotency_key,
        actor,
        db,
    )
    from app.services.collections import wire_row

    return {
        "data": {
            "membership": wire_row(result["membership"]),
            "event_id": result["event_id"],
        },
        "meta": {"request_id": request.state.request_id},
    }


@router.post(
    "/associations/{association_id}/members",
    status_code=201,
    response_model=Single[MembershipDTO],
)
async def grant(
    association_id: UUID,
    body: MemberGrant,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await command(
        "grant",
        association_id,
        body.model_dump(mode="json"),
        idempotency_key,
        actor,
        db,
    )
    rows = await db.read(
        "association_members",
        actor.token,
        {
            "select": "*",
            "association_id": f"eq.{association_id}",
            "profile_id": f"eq.{body.profile_id}",
        },
    )
    rows[0]["revision"] = str(rows[0]["revision"])
    return {"data": rows[0], "meta": {"request_id": request.state.request_id}}


@router.patch(
    "/associations/{association_id}/members/{profile_id}",
    response_model=Single[MembershipDTO],
)
async def edit_member(
    association_id: UUID,
    profile_id: UUID,
    body: MemberEdit,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await command(
        "member_edit",
        association_id,
        body.model_dump(mode="json", exclude_none=True)
        | {"profile_id": str(profile_id)},
        idempotency_key,
        actor,
        db,
    )
    rows = await db.read(
        "association_members",
        actor.token,
        {
            "select": "*",
            "association_id": f"eq.{association_id}",
            "profile_id": f"eq.{profile_id}",
        },
    )
    rows[0]["revision"] = str(rows[0]["revision"])
    return {"data": rows[0], "meta": {"request_id": request.state.request_id}}
