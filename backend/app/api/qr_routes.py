"""qr routes endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.adapters.supabase import Supabase
from app.api.bookings import booking_response
from app.api.dependencies import Actor, database, enabled
from app.api.responses import QRDTO, ResolveDTO, Single
from app.api.workflow_models import (
    QRInput,
)
from app.api.workflow_shared import (
    booking_record,
    projected_offer,
    proof_for,
)
from app.domain.errors import DomainError
from app.domain.qr import QRSigner
from app.services.donations import donation_view
from app.services.workflow import (
    offer_context,
)

router = APIRouter(prefix="/api/v1", tags=["qr_routes"])


@router.get("/bookings/{booking_id}/qr", response_model=Single[QRDTO])
async def qr(
    booking_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    row = await booking_record(booking_id, actor, db)
    # Donor-only QR issuance; target staff resolve rather than issue donor proofs.
    await donation_view(db, actor, UUID(str(row["donation_id"])))
    context = await offer_context(db, actor, UUID(str(row["offer_id"])))
    proof = proof_for(row)
    if row["status"] != "booked" or context.as_of >= proof.valid_until:
        raise DomainError("deadline_elapsed")
    payload = QRSigner(
        request.app.state.settings.qr_signing_key.get_secret_value()
    ).sign(proof)
    return {
        "data": {
            "booking_id": str(booking_id),
            "payload": payload,
            "format": "dono.booking.v1",
            "valid_until": proof.valid_until,
        },
        "meta": {"request_id": request.state.request_id},
    }


@router.post(
    "/associations/{association_id}/qr/resolve", response_model=Single[ResolveDTO]
)
async def resolve(
    association_id: UUID,
    body: QRInput,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    memberships = await db.read(
        "association_members",
        actor.token,
        {
            "select": "role",
            "association_id": f"eq.{association_id}",
            "profile_id": f"eq.{actor.id}",
            "active": "eq.true",
        },
    )
    associations = await db.read(
        "associations",
        actor.token,
        {
            "select": "id",
            "id": f"eq.{association_id}",
            "approval_status": "eq.approved",
        },
    )
    if not memberships or not associations:
        raise DomainError("forbidden", 403)
    signer = QRSigner(request.app.state.settings.qr_signing_key.get_secret_value())
    proof = signer.decode(body.payload)
    if proof.association_id != association_id:
        raise DomainError("not_found", 404)
    row = await booking_record(proof.booking_id, actor, db)
    signer.verify(body.payload, proof_for(row))
    context = await offer_context(db, actor, UUID(str(row["offer_id"])))
    codes = []
    if row["status"] != "booked" or context.offer["status"] != "approved":
        codes.append("invalid_transition")
    if (
        context.slot is None
        or not datetime.fromisoformat(context.slot["starts_at"])
        <= context.as_of
        < proof.valid_until
    ):
        codes.append("outside_reception_window")
    return {
        "data": {
            "booking": (await booking_response(proof.booking_id, request, actor, db))[
                "data"
            ],
            "offer": projected_offer(context),
            "receivable": not codes,
            "blocking_codes": codes,
        },
        "meta": {"request_id": request.state.request_id},
    }
