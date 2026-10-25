"""Recipient review and dated arrivals, always using frozen offer projections."""

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request

from app.adapters.supabase import Supabase
from app.analysis.schemas.models import Category
from app.api.collection_shared import page_response
from app.api.dependencies import Actor, database, enabled
from app.api.responses import ArrivalDTO, OfferDTO, Page
from app.api.workflow_shared import projected_offer
from app.services.collections import member, wire_row
from app.services.workflow import OfferContext

router = APIRouter(prefix="/api/v1/associations", tags=["review collections"])
Limit = Annotated[int, Query(ge=1, le=100)]
OfferState = Literal[
    "pending_review",
    "approved",
    "refused",
    "withdrawn",
    "cancelled",
    "expired",
    "fulfilled",
]


async def contexts(db: Supabase, actor: Actor, tenant: UUID) -> list[OfferContext]:
    await member(db, actor, tenant)
    context = (
        await db.command("offer_list", actor.id, {"tenant": str(tenant), "item": None})
    )[0]
    records = context.get("offers", [])
    return (
        [OfferContext.model_validate(record) for record in records]
        if isinstance(records, list)
        else []
    )


@router.get("/{association_id}/offers", response_model=Page[OfferDTO])
async def offers(
    association_id: UUID,
    request: Request,
    effective_state: OfferState = "pending_review",
    category: Category | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = [
        projected_offer(context)
        for context in await contexts(db, actor, association_id)
    ]
    rows = [
        r
        for r in rows
        if r["computed"]["effective_state"] == effective_state
        and (category is None or r["category"] == category)
    ]
    return page_response(
        rows,
        request,
        actor,
        limit,
        cursor,
        {"state": effective_state, "category": category},
    )


@router.get("/{association_id}/arrivals", response_model=Page[ArrivalDTO])
async def arrivals(
    association_id: UUID,
    request: Request,
    day: Annotated[date | None, Query(alias="date")] = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    records = await contexts(db, actor, association_id)
    if day is None:
        association = (
            await db.read(
                "associations",
                actor.token,
                {"select": "timezone", "id": f"eq.{association_id}"},
            )
        )[0]
        day = datetime.now(ZoneInfo(str(association["timezone"]))).date()
    rows = []
    for record in records:
        if (
            not record.booking
            or not record.slot
            or record.booking["quota_date"] != day.isoformat()
        ):
            continue
        booking = wire_row(record.booking)
        booking.pop("qr_nonce", None)
        booking["computed"] = {
            "effective_state": (
                "no_show"
                if booking["status"] == "booked"
                and record.as_of >= datetime.fromisoformat(booking["receivable_until"])
                else booking["status"]
            ),
            "starts_at": record.slot["starts_at"],
            "ends_at": record.slot["ends_at"],
        }
        rows.append(
            {
                "id": booking["id"],
                "starts_at": record.slot["starts_at"],
                "booking": booking,
                "offer": projected_offer(record),
            }
        )
    result = page_response(
        rows,
        request,
        actor,
        limit,
        cursor,
        {"date": day.isoformat()},
        keys=("starts_at", "id"),
        reverse=False,
    )
    result["data"] = [
        {key: value for key, value in row.items() if key not in ("id", "starts_at")}
        for row in result["data"]
    ]
    return result
