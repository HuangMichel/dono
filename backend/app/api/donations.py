"""Donation routes delegate state changes to atomic database commands."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor, database, enabled
from app.api.models import CreateDonation, EditDonation, RevisionAction
from app.api.responses import DonationDTO, Single
from app.services.donations import donation_view

router = APIRouter(prefix="/api/v1/donations", tags=["donations"])


async def mutate(
    action: str,
    item: UUID | None,
    body: dict[str, object],
    key: UUID,
    request: Request,
    actor: Actor,
    db: Supabase,
) -> dict[str, object]:
    result = (
        await db.command(
            "item",
            actor.id,
            {
                "key": str(key),
                "action": action,
                "item": str(item) if item else None,
                "body": body,
            },
        )
    )[0]
    return {
        "data": await donation_view(db, actor, UUID(str(result["id"]))),
        "meta": {
            "request_id": request.state.request_id,
            "idempotent_replay": result.get("replay", False),
        },
    }


@router.post("", status_code=201, response_model=Single[DonationDTO])
async def create(
    body: CreateDonation,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return await mutate(
        "create",
        None,
        body.model_dump(mode="json", exclude_none=True),
        idempotency_key,
        request,
        actor,
        db,
    )


@router.get("/{donation_id}", response_model=Single[DonationDTO])
async def read(
    donation_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return {
        "data": await donation_view(db, actor, donation_id),
        "meta": {"request_id": request.state.request_id},
    }


@router.patch("/{donation_id}", response_model=Single[DonationDTO])
async def edit(
    donation_id: UUID,
    body: EditDonation,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return await mutate(
        "edit",
        donation_id,
        body.model_dump(mode="json"),
        idempotency_key,
        request,
        actor,
        db,
    )


@router.post("/{donation_id}/publication", response_model=Single[DonationDTO])
async def publish(
    donation_id: UUID,
    body: RevisionAction,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return await mutate(
        "publication",
        donation_id,
        body.model_dump(mode="json"),
        idempotency_key,
        request,
        actor,
        db,
    )


@router.post("/{donation_id}/restoration", response_model=Single[DonationDTO])
async def restore(
    donation_id: UUID,
    body: RevisionAction,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return await mutate(
        "restoration",
        donation_id,
        body.model_dump(mode="json"),
        idempotency_key,
        request,
        actor,
        db,
    )


class Withdrawal(RevisionAction):
    reason: str | None = None


@router.post("/{donation_id}/withdrawal", response_model=Single[DonationDTO])
async def withdrawal(
    donation_id: UUID,
    body: Withdrawal,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await db.command(
        "item_withdrawal",
        actor.id,
        {
            "key": str(idempotency_key),
            "item": str(donation_id),
            "body": body.model_dump(mode="json", exclude_none=True),
        },
    )
    return {
        "data": await donation_view(db, actor, donation_id),
        "meta": {"request_id": request.state.request_id},
    }
