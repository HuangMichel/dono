"""stock commands endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.adapters.supabase import Supabase
from app.api.bookings import booking_response
from app.api.dependencies import Actor, database, enabled
from app.api.responses import MovementDTO, ReceptionDTO, Single
from app.api.workflow_models import Distribution, Reception
from app.api.workflow_shared import (
    booking_record,
    projected_offer,
    proof_for,
    replay_lookup,
)
from app.domain.errors import DomainError
from app.domain.qr import QRSigner
from app.services.workflow import (
    guard_for,
    offer_context,
)

router = APIRouter(prefix="/api/v1", tags=["stock_commands"])


@router.post("/bookings/{booking_id}/reception", response_model=Single[ReceptionDTO])
async def receive(
    booking_id: UUID,
    body: Reception,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    replay = await replay_lookup(
        db,
        actor,
        idempotency_key,
        f"stock/receive/{booking_id}",
        body.model_dump(mode="json", exclude_none=True),
    )
    if replay:
        context = await offer_context(db, actor, UUID(str(replay["offer_id"])))
        receipts = await db.read(
            "inventory_movements",
            actor.token,
            {"select": "*", "id": f"eq.{replay['id']}"},
        )
        return {
            "data": {
                "booking": (await booking_response(booking_id, request, actor, db))[
                    "data"
                ],
                "offer": projected_offer(context),
                "receipt": receipts[0],
                "donation_state": "transferred",
            },
            "meta": {"request_id": request.state.request_id, "idempotent_replay": True},
        }
    row = await booking_record(booking_id, actor, db)
    context = await offer_context(db, actor, UUID(str(row["offer_id"])))
    QRSigner(request.app.state.settings.qr_signing_key.get_secret_value()).verify(
        body.payload, proof_for(row)
    )
    guard = guard_for(
        context,
        body.date_checks.model_dump(exclude_none=True) if body.date_checks else {},
        body.reason,
    )
    guard["qr_nonce"] = row["qr_nonce"]
    outcome = (
        await db.command(
            "stock_command",
            actor.id,
            {
                "key": str(idempotency_key),
                "action": "receive",
                "booking": str(booking_id),
                "receipt": None,
                "body": body.model_dump(mode="json", exclude_none=True),
                "guard": guard,
            },
        )
    )[0]
    receipts = await db.read(
        "inventory_movements", actor.token, {"select": "*", "id": f"eq.{outcome['id']}"}
    )
    return {
        "data": {
            "booking": (await booking_response(booking_id, request, actor, db))["data"],
            "offer": projected_offer(
                await offer_context(db, actor, UUID(str(row["offer_id"])))
            ),
            "receipt": receipts[0],
            "donation_state": "transferred",
        },
        "meta": {"request_id": request.state.request_id},
    }


@router.post(
    "/inventory/{receipt_id}/distributions",
    status_code=201,
    response_model=Single[MovementDTO],
)
async def distribute(
    receipt_id: UUID,
    body: Distribution,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    replay = await replay_lookup(
        db,
        actor,
        idempotency_key,
        f"stock/distribute/{receipt_id}",
        body.model_dump(mode="json", exclude_none=True),
    )
    if replay:
        rows = await db.read(
            "inventory_movements",
            actor.token,
            {"select": "*", "id": f"eq.{replay['id']}"},
        )
        return {
            "data": rows[0],
            "meta": {"request_id": request.state.request_id, "idempotent_replay": True},
        }
    receipts = await db.read(
        "inventory_movements",
        actor.token,
        {"select": "*", "id": f"eq.{receipt_id}", "movement_type": "eq.receipt"},
    )
    if not receipts:
        raise DomainError("not_found", 404)
    context = await offer_context(db, actor, UUID(str(receipts[0]["offer_id"])))
    guard = guard_for(
        context,
        body.date_checks.model_dump(exclude_none=True) if body.date_checks else {},
        body.reason,
    )
    outcome = (
        await db.command(
            "stock_command",
            actor.id,
            {
                "key": str(idempotency_key),
                "action": "distribute",
                "booking": None,
                "receipt": str(receipt_id),
                "body": body.model_dump(mode="json", exclude_none=True),
                "guard": guard,
            },
        )
    )[0]
    rows = await db.read(
        "inventory_movements", actor.token, {"select": "*", "id": f"eq.{outcome['id']}"}
    )
    return {"data": rows[0], "meta": {"request_id": request.state.request_id}}
