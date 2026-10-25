"""bookings endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor, database, enabled
from app.api.responses import BookingDTO, CancellationDTO, Single
from app.api.workflow_models import (
    Book,
    Cancellation,
)
from app.api.workflow_shared import (
    booking_record,
    projected_offer,
    replay_lookup,
)
from app.domain.errors import DomainError
from app.services.workflow import (
    OfferContext,
    guard_for,
    offer_context,
)

router = APIRouter(prefix="/api/v1", tags=["bookings"])


@router.post(
    "/offers/{offer_id}/bookings", status_code=201, response_model=Single[BookingDTO]
)
async def book(
    offer_id: UUID,
    body: Book,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    replay = await replay_lookup(
        db,
        actor,
        idempotency_key,
        f"workflow/book/{offer_id}",
        body.model_dump(mode="json"),
    )
    if replay:
        return await booking_response(
            UUID(str(replay["booking_id"])), request, actor, db
        )
    context = await offer_context(db, actor, offer_id)
    options = (await db.command("offer_slots", actor.id, {"attempt": str(offer_id)}))[
        0
    ]["slots"]
    if not isinstance(options, list):
        raise DomainError("database_unavailable", 503)
    chosen = next(
        (option for option in options if option["id"] == str(body.slot_id)), None
    )
    if chosen is None:
        raise DomainError("invalid_transition")
    guard = guard_for(
        context, {}, None, booking_at=datetime.fromisoformat(chosen["starts_at"])
    )
    outcome = (
        await db.command(
            "offer_command",
            actor.id,
            {
                "key": str(idempotency_key),
                "action": "book",
                "item": None,
                "attempt": str(offer_id),
                "body": body.model_dump(mode="json"),
                "guard": guard,
            },
        )
    )[0]
    return await booking_response(UUID(str(outcome["booking_id"])), request, actor, db)


@router.get("/bookings/{booking_id}", response_model=Single[BookingDTO])
async def booking_response(
    booking_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    row = await booking_record(booking_id, actor, db)
    context = await offer_context(db, actor, UUID(str(row["offer_id"])))
    return booking_projection(row, context, request)


@router.get("/offers/{offer_id}/booking", response_model=Single[BookingDTO])
async def offer_booking(
    offer_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    """Restore an appointment through the existing offer visibility guard."""
    context = await offer_context(db, actor, offer_id)
    if context.booking is None:
        raise DomainError("not_found", 404)
    return booking_projection(context.booking, context, request)


def booking_projection(
    booking: dict[str, object], context: OfferContext, request: Request
) -> dict[str, object]:
    row = dict(booking)
    if context.slot is None:
        raise DomainError("database_unavailable", 503)
    row["computed"] = {
        "effective_state": (
            "no_show"
            if row["status"] == "booked"
            and context.as_of >= datetime.fromisoformat(str(row["receivable_until"]))
            else row["status"]
        ),
        "starts_at": context.slot["starts_at"],
        "ends_at": context.slot["ends_at"],
    }
    row.pop("qr_nonce", None)
    row["revision"] = str(row["revision"])
    return {"data": row, "meta": {"request_id": request.state.request_id}}


@router.post(
    "/bookings/{booking_id}/cancellation", response_model=Single[CancellationDTO]
)
async def cancel_booking(
    booking_id: UUID,
    body: Cancellation,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    row = await booking_record(booking_id, actor, db)
    await db.command(
        "offer_command",
        actor.id,
        {
            "key": str(idempotency_key),
            "action": "cancel_booking",
            "item": None,
            "attempt": str(row["offer_id"]),
            "body": body.model_dump(mode="json"),
        },
    )
    return {
        "data": {
            "booking": (await booking_response(booking_id, request, actor, db))["data"],
            "offer": projected_offer(
                await offer_context(db, actor, UUID(str(row["offer_id"])))
            ),
        },
        "meta": {"request_id": request.state.request_id},
    }
