"""offers endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor, database, enabled
from app.api.models import Facts
from app.api.responses import OfferDTO, Single
from app.api.workflow_models import Cancellation, Decision, Submit, WithdrawalInput
from app.api.workflow_shared import changed_offer, replay_lookup
from app.services.donations import donation_view
from app.services.workflow import (
    guard_for,
    offer_context,
    submission_guard,
)

router = APIRouter(prefix="/api/v1", tags=["offers"])


@router.post(
    "/donations/{donation_id}/offers", status_code=201, response_model=Single[OfferDTO]
)
async def submit(
    donation_id: UUID,
    body: Submit,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    replay = await replay_lookup(
        db,
        actor,
        idempotency_key,
        f"workflow/submit/{donation_id}",
        body.model_dump(mode="json"),
    )
    if replay:
        return await changed_offer(db, actor, UUID(str(replay["id"])), request)
    donation = await donation_view(db, actor, donation_id)
    guard = await submission_guard(
        db,
        actor,
        donation_id,
        body.need_id,
        body.association_id,
        Facts.model_validate(donation["facts"]),
    )
    result = (
        await db.command(
            "offer_command",
            actor.id,
            {
                "key": str(idempotency_key),
                "action": "submit",
                "item": str(donation_id),
                "attempt": None,
                "body": body.model_dump(mode="json"),
                "guard": guard,
            },
        )
    )[0]
    return await changed_offer(db, actor, UUID(str(result["id"])), request)


@router.get("/offers/{offer_id}", response_model=Single[OfferDTO])
async def read_offer(
    offer_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return await changed_offer(db, actor, offer_id, request)


@router.post("/offers/{offer_id}/decision", response_model=Single[OfferDTO])
async def decide(
    offer_id: UUID,
    body: Decision,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    replay = await replay_lookup(
        db,
        actor,
        idempotency_key,
        f"workflow/decision/{offer_id}",
        body.model_dump(mode="json", exclude_none=True),
    )
    if replay:
        return await changed_offer(db, actor, offer_id, request)
    context = await offer_context(db, actor, offer_id)
    checks = (
        body.intake_checks.model_dump(exclude_none=True) if body.intake_checks else {}
    )
    guard = (
        guard_for(context, checks, body.reason, approval=True)
        if body.decision == "approved"
        else None
    )
    await db.command(
        "offer_command",
        actor.id,
        {
            "key": str(idempotency_key),
            "action": "decision",
            "item": None,
            "attempt": str(offer_id),
            "body": body.model_dump(mode="json", exclude_none=True),
            "guard": guard,
        },
    )
    return await changed_offer(db, actor, offer_id, request)


@router.post("/offers/{offer_id}/withdrawal", response_model=Single[OfferDTO])
async def withdraw(
    offer_id: UUID,
    body: WithdrawalInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await db.command(
        "offer_command",
        actor.id,
        {
            "key": str(idempotency_key),
            "action": "withdraw",
            "item": None,
            "attempt": str(offer_id),
            "body": body.model_dump(mode="json"),
        },
    )
    return await changed_offer(db, actor, offer_id, request)


@router.post("/offers/{offer_id}/cancellation", response_model=Single[OfferDTO])
async def cancel(
    offer_id: UUID,
    body: Cancellation,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await db.command(
        "offer_command",
        actor.id,
        {
            "key": str(idempotency_key),
            "action": "cancel",
            "item": None,
            "attempt": str(offer_id),
            "body": body.model_dump(mode="json"),
        },
    )
    return await changed_offer(db, actor, offer_id, request)
