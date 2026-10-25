"""Account, registration and membership collection reads."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.adapters.supabase import Supabase
from app.api.collection_shared import page_response
from app.api.dependencies import Actor, database, enabled
from app.api.responses import (
    AssociationDTO,
    MembershipDTO,
    MembershipEventDTO,
    Page,
    RedirectDTO,
)
from app.domain.errors import DomainError
from app.services.collections import all_rows, member, wire_row

router = APIRouter(prefix="/api/v1", tags=["account collections"])
Limit = Annotated[int, Query(ge=1, le=100)]


@router.get("/account/memberships", response_model=Page[MembershipDTO])
async def memberships(
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await all_rows(
        db, actor, "association_members", {"profile_id": f"eq.{actor.id}"}
    )
    return page_response(
        [wire_row(row) for row in rows],
        request,
        actor,
        limit,
        cursor,
        keys=("association_id", "profile_id"),
        reverse=False,
    )


@router.get("/admin/associations", response_model=Page[AssociationDTO])
async def registrations(
    request: Request,
    approval_status: Literal["pending", "approved"] | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    profile = await db.read(
        "profiles", actor.token, {"select": "platform_role", "id": f"eq.{actor.id}"}
    )
    if not profile or profile[0]["platform_role"] != "platform_admin":
        raise DomainError("forbidden", 403)
    rows = await all_rows(
        db,
        actor,
        "associations",
        {"approval_status": f"eq.{approval_status}"} if approval_status else {},
    )
    return page_response(
        [wire_row(row) for row in rows],
        request,
        actor,
        limit,
        cursor,
        {"status": approval_status},
    )


@router.get(
    "/associations/{association_id}/members", response_model=Page[MembershipDTO]
)
async def roster(
    association_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await member(db, actor, association_id, admin=True)
    rows = await all_rows(
        db, actor, "association_members", {"association_id": f"eq.{association_id}"}
    )
    return page_response(
        [wire_row(row) for row in rows],
        request,
        actor,
        limit,
        cursor,
        keys=("association_id", "profile_id"),
        reverse=False,
    )


@router.get(
    "/associations/{association_id}/membership-events",
    response_model=Page[MembershipEventDTO],
)
async def member_events(
    association_id: UUID,
    request: Request,
    profile_id: UUID | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await member(db, actor, association_id, admin=True)
    filters = {"association_id": f"eq.{association_id}"}
    if profile_id:
        filters["profile_id"] = f"eq.{profile_id}"
    rows = await all_rows(db, actor, "membership_events", filters)
    return page_response(
        rows, request, actor, limit, cursor, {"profile": str(profile_id)}
    )


@router.get("/redirect-points", response_model=Page[RedirectDTO])
async def redirects(
    request: Request,
    kind: Literal["pharmacy", "textile_bin", "repair_cafe"] | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await all_rows(
        db, actor, "redirect_points", {"kind": f"eq.{kind}"} if kind else {}
    )
    for row in rows:
        row.pop("active", None)
        row.pop("description", None)
        row["url"] = None
    return page_response(
        rows, request, actor, limit, cursor, {"kind": kind}, keys=("id",), reverse=False
    )
