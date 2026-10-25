"""Explicit donor consent and limited association discovery."""

import base64
import hashlib
import json
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.adapters.geocoding import BANGeocoder
from app.adapters.photos import decode_photo, discovery_photo
from app.adapters.supabase import Supabase
from app.analysis.schemas.models import Category, ClosedModel
from app.api.dependencies import Actor, database, enabled
from app.api.models import RevisionAction
from app.api.public_needs import cursor_offset
from app.api.responses import DonationDTO, Page, RowDTO, Single
from app.domain.errors import DomainError
from app.services.donations import donation_view
from app.services.pagination import CursorPages

router = APIRouter(prefix="/api/v1", tags=["posted donations"])


class PostingInput(RevisionAction):
    location: Annotated[str, Field(min_length=3, max_length=200)]


class PostedIndicator(ClosedModel):
    key: str
    value: str | None
    probability: float | None
    level: Literal["low", "medium", "high"] | None


class PostedPhoto(BaseModel):
    id: UUID
    content_url: str


class PostedExpiry(BaseModel):
    expiry_date: str | None = None
    date_type: Literal["DLC", "DDM", "expiry", "PAO"] | None = None
    pao_months: int | None = None
    opened_on: str | None = None
    date_precision: str | None = None
    readability: str | None = None


class PostedDonation(RowDTO):
    name: str | None = None
    description: str | None = None
    id: UUID
    category: Category
    attributes: dict[str, Any]
    quantity: str
    unit: Literal["item"]
    expiry: PostedExpiry
    indicators: list[PostedIndicator]
    photos: list[PostedPhoto]
    posted_at: str
    locality: str
    distance_km: float


@router.post("/donations/{donation_id}/posting", response_model=Single[DonationDTO])
async def posting(
    donation_id: UUID,
    body: PostingInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    # Verify ownership before sending the supplied municipality to the geocoder.
    rows = await db.read(
        "donations",
        actor.token,
        {"select": "id", "id": f"eq.{donation_id}", "donor_id": f"eq.{actor.id}"},
    )
    if not rows:
        raise DomainError("not_found", 404)
    location = await BANGeocoder(
        request.app.state.http, request.app.state.settings.geocoding_base_url
    ).geocode(body.location, municipality_only=True)
    if not location.city:
        raise DomainError("geocoding_unavailable", 503)
    return await change_posting(
        donation_id,
        "posting",
        body.model_dump(mode="json")
        | {
            "locality": location.city,
            "latitude": location.latitude,
            "longitude": location.longitude,
        },
        idempotency_key,
        request,
        actor,
        db,
    )


@router.post("/donations/{donation_id}/unposting", response_model=Single[DonationDTO])
async def unposting(
    donation_id: UUID,
    body: RevisionAction,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    return await change_posting(
        donation_id,
        "unposting",
        body.model_dump(mode="json"),
        idempotency_key,
        request,
        actor,
        db,
    )


async def change_posting(
    item: UUID,
    action: str,
    body: dict[str, object],
    key: UUID,
    request: Request,
    actor: Actor,
    db: Supabase,
) -> dict[str, object]:
    result = (
        await db.command(
            "posting",
            actor.id,
            {
                "key": str(key),
                "item": str(item),
                "action": action,
                "body": body,
            },
        )
    )[0]
    return {
        "data": await donation_view(db, actor, item),
        "meta": {
            "request_id": request.state.request_id,
            "idempotent_replay": result["replay"],
        },
    }


@router.get(
    "/associations/{association_id}/posted-donations",
    response_model=Page[PostedDonation],
)
async def nearby(
    association_id: UUID,
    request: Request,
    category: Category | None = None,
    radius_km: Annotated[float, Query(ge=1, le=200, allow_inf_nan=False)] = 25,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    cursor: Annotated[str | None, Query(max_length=4096)] = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    scope = hashlib.sha256(
        json.dumps(
            {
                "actor": str(actor.id),
                "association": str(association_id),
                "category": category,
                "radius": radius_km,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    pages = CursorPages(request.app.state.settings.qr_signing_key.get_secret_value())
    offset = cursor_offset(cursor, scope, pages)
    result = (
        await db.command(
            "posted_donations",
            actor.id,
            {
                "tenant": str(association_id),
                "filter_category": category,
                "radius_km": radius_km,
                "page_limit": limit,
                "page_offset": offset,
            },
        )
    )[0]
    next_cursor = None
    if result["has_more"]:
        encoded = (
            base64.urlsafe_b64encode(
                json.dumps(
                    {
                        "offset": offset + limit,
                        "scope": scope,
                    }
                ).encode()
            )
            .decode()
            .rstrip("=")
        )
        next_cursor = encoded + "." + pages._sign(encoded)
    return {
        "data": result["data"],
        "page": {
            "next_cursor": next_cursor,
            "has_more": result["has_more"],
        },
        "meta": {
            "request_id": request.state.request_id,
            "as_of": result["as_of"],
            "policy_version": "mvp-domain-v1",
        },
    }


@router.get(
    "/associations/{association_id}/posted-donations/{donation_id}/photos/{photo_id}/content"
)
async def photo_content(
    association_id: UUID,
    donation_id: UUID,
    photo_id: UUID,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> Response:
    row = (
        await db.command(
            "posted_photo",
            actor.id,
            {
                "tenant": str(association_id),
                "item": str(donation_id),
                "photo": str(photo_id),
            },
        )
    )[0]
    metadata = row["photo"]
    if not isinstance(metadata, dict):
        raise DomainError("photo_integrity_error", 500)
    content = decode_photo(
        str(row["image_base64"]),
        int(metadata["size_bytes"]),
        str(metadata["sha256"]),
    )
    return Response(
        await run_in_threadpool(discovery_photo, content),
        media_type="image/png",
        headers={
            "X-Content-Type-Options": "nosniff",
        },
    )
