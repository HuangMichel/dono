"""Public discovery exposes need summaries; offering still requires an account."""

import base64
import hashlib
import hmac
import json
import re
from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.adapters.geocoding import BANGeocoder
from app.adapters.supabase import Supabase
from app.analysis.schemas.models import Category
from app.api.dependencies import database
from app.api.responses import Page, RowDTO
from app.domain.errors import DomainError
from app.services.pagination import CursorPages

router = APIRouter(prefix="/api/v1/public", tags=["public discovery"])


class PublicAssociation(BaseModel):
    id: UUID
    name: str
    display_address: str


class PublicNeed(RowDTO):
    id: UUID
    association: PublicAssociation
    category: Category
    attributes: dict[str, Any]
    seasons: list[str]
    target_quantity: str
    available_quantity: str
    unit: Literal["item"]
    distance_km: float | None


def cursor_offset(cursor: str | None, scope: str, pages: CursorPages) -> int:
    if cursor is None:
        return 0
    try:
        body, signature = cursor.split(".")
        if not hmac.compare_digest(signature, pages._sign(body)):
            raise ValueError("signature")
        value = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        offset = value["offset"]
        if value["scope"] != scope or type(offset) is not int or offset < 0:
            raise ValueError("scope or offset")
        return offset
    except (ValueError, KeyError, TypeError) as exc:
        raise DomainError("invalid_cursor", 422) from exc


@router.get("/needs", response_model=Page[PublicNeed])
async def public_needs(
    request: Request,
    location: Annotated[str | None, Query(max_length=200)] = None,
    category: Category | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    cursor: Annotated[str | None, Query(max_length=4096)] = None,
    db: Supabase = Depends(database),
) -> dict[str, Any]:
    location = location.strip() if location else ""
    scope = hashlib.sha256(
        json.dumps(
            {"location": location, "category": category}, sort_keys=True
        ).encode()
    ).hexdigest()
    pages = CursorPages(request.app.state.settings.qr_signing_key.get_secret_value())
    offset = cursor_offset(cursor, scope, pages)
    origin = None
    filter_city = None
    filter_postcode = None
    if location:
        origin = await BANGeocoder(
            request.app.state.http, request.app.state.settings.geocoding_base_url
        ).geocode(location, municipality_only=True)
        if re.fullmatch(r"[0-9]{5}", location):
            filter_postcode = location
        elif origin.city:
            filter_city = origin.city
        else:
            raise DomainError("geocoding_unavailable", 503)
    result = await db.public_needs(
        {
            "filter_category": category,
            "filter_city": filter_city,
            "filter_postcode": filter_postcode,
            "origin_latitude": origin.latitude if origin else None,
            "origin_longitude": origin.longitude if origin else None,
            "page_limit": limit,
            "page_offset": offset,
        }
    )
    next_cursor = None
    if result["has_more"]:
        body = (
            base64.urlsafe_b64encode(
                json.dumps({"offset": offset + limit, "scope": scope}).encode()
            )
            .decode()
            .rstrip("=")
        )
        next_cursor = body + "." + pages._sign(body)
    return {
        "data": result["data"],
        "page": {"next_cursor": next_cursor, "has_more": result["has_more"]},
        "meta": {
            "request_id": request.state.request_id,
            "as_of": result.get("as_of", datetime.now(UTC)),
            "policy_version": "mvp-domain-v1",
        },
    }
