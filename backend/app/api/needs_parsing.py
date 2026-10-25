"""Admin-only parsing returns a draft; explicit configuration saves the need."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import Field

from app.adapters.needs import parse_need
from app.adapters.supabase import Supabase
from app.analysis.schemas.models import ClosedModel
from app.api.dependencies import Actor, database, enabled
from app.api.responses import ParsedNeedDTO, Single
from app.services.collections import member

router = APIRouter(prefix="/api/v1/associations", tags=["needs parsing"])


class ParseInput(ClosedModel):
    text: Annotated[str, Field(min_length=1, max_length=2000)]


@router.post("/{association_id}/needs/parse", response_model=Single[ParsedNeedDTO])
async def parse(
    association_id: UUID,
    body: ParseInput,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await member(db, actor, association_id, admin=True)
    result = await parse_need(
        request.app.state.http, request.app.state.settings, body.text
    )
    await member(db, actor, association_id, admin=True)
    return {"data": result, "meta": {"request_id": request.state.request_id}}
