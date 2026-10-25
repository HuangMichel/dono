"""Audited administrator transfer and bounded deadline materialization."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from pydantic import Field

from app.adapters.supabase import Supabase
from app.analysis.schemas.models import ClosedModel
from app.api.associations import command
from app.api.dependencies import Actor, database, enabled
from app.api.models import Revision
from app.api.responses import ReconciliationDTO, Single, TransferDTO
from app.services.collections import wire_row

router = APIRouter(prefix="/api/v1/associations", tags=["administration"])


class Transfer(ClosedModel):
    expected_revision: Revision
    target_profile_id: UUID


class Reconcile(ClosedModel):
    limit: Annotated[int, Field(strict=True, ge=1, le=100)] = 50


@router.post("/{association_id}/admin-transfer", response_model=Single[TransferDTO])
async def transfer(
    association_id: UUID,
    body: Transfer,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = await command(
        "transfer",
        association_id,
        body.model_dump(mode="json"),
        idempotency_key,
        actor,
        db,
    )
    return {
        "data": {
            "initiator": wire_row(result["initiator"]),
            "target": wire_row(result["target"]),
            "event_ids": result["event_ids"],
        },
        "meta": {"request_id": request.state.request_id},
    }


@router.post(
    "/{association_id}/expiration-reconciliation",
    response_model=Single[ReconciliationDTO],
)
async def reconciliation(
    association_id: UUID,
    body: Reconcile,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    result = (
        await db.command(
            "reconcile",
            actor.id,
            {
                "key": str(idempotency_key),
                "tenant": str(association_id),
                "body": body.model_dump(mode="json"),
            },
        )
    )[0]
    return {"data": result, "meta": {"request_id": request.state.request_id}}
