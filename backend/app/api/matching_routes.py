"""matching routes endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor, database, enabled
from app.api.models import Facts
from app.api.responses import MatchDTO, Page
from app.api.workflow_models import MatchInput
from app.services.donations import donation_view
from app.services.workflow import (
    matches,
)

router = APIRouter(prefix="/api/v1", tags=["matching_routes"])


@router.post("/donations/{donation_id}/matches", response_model=Page[MatchDTO])
async def matching(
    donation_id: UUID,
    body: MatchInput,
    request: Request,
    limit: int = Query(default=25, ge=1, le=100),
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    donation = await donation_view(db, actor, donation_id)
    from app.adapters.geocoding import BANGeocoder

    if body.origin:
        origin = (body.origin.latitude, body.origin.longitude)
    else:
        location = await BANGeocoder(
            request.app.state.http, request.app.state.settings.geocoding_base_url
        ).geocode(body.address or "")
        origin = (location.latitude, location.longitude)
    data = await matches(
        db,
        actor,
        donation_id,
        Facts.model_validate(donation["facts"]),
        origin,
    )
    from datetime import UTC, datetime

    from app.services.pagination import CursorPages

    for row in data:
        association = row["association"]
        if isinstance(association, dict):
            row["_sort"] = (row["distance_km"], association["id"], row["need_id"])
    selected, page = CursorPages(
        request.app.state.settings.qr_signing_key.get_secret_value()
    ).page(
        data,
        scope={
            "actor": str(actor.id),
            "path": request.url.path,
            "origin": body.model_dump(mode="json"),
        },
        limit=limit,
        cursor=cursor,
        preserve_order=True,
        sort_keys=("_sort",),
        reverse=False,
    )
    for row in selected:
        row.pop("_sort", None)
    return {
        "data": selected,
        "page": page,
        "meta": {
            "request_id": request.state.request_id,
            "as_of": datetime.now(UTC),
            "policy_version": "mvp-domain-v1",
        },
    }
