"""Stock and expiry projections with metadata-only global FEFO pagination."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.adapters.supabase import Supabase
from app.analysis.schemas.models import Category
from app.api.dependencies import Actor, database, enabled
from app.api.responses import ExpiryCountsDTO, GalleryDTO, Page, Single, StockLotDTO
from app.domain.expiry import Bucket
from app.services.inventory import expiry_counts, lot_dto, stock
from app.services.pagination import CursorPages

router = APIRouter(prefix="/api/v1/associations", tags=["inventory"])


def paginator(request: Request) -> CursorPages:
    return CursorPages(request.app.state.settings.qr_signing_key.get_secret_value())


@router.get("/{association_id}/inventory", response_model=Page[StockLotDTO])
async def inventory(
    association_id: UUID,
    request: Request,
    inventory_state: Literal["in_stock", "distributed"] = "in_stock",
    category: Category | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows, meta = await stock(db, actor, association_id, category)
    rows = [row for row in rows if row["inventory_state"] == inventory_state]
    selected, page = paginator(request).page(
        rows,
        scope={
            "actor": str(actor.id),
            "path": request.url.path,
            "category": category,
            "state": inventory_state,
        },
        limit=limit,
        cursor=cursor,
    )
    return {
        "data": [lot_dto(row) for row in selected],
        "page": page,
        "meta": {
            "request_id": request.state.request_id,
            "as_of": meta["as_of"],
            "policy_version": "mvp-domain-v1",
        },
    }


@router.get("/{association_id}/expiry-counts", response_model=Single[ExpiryCountsDTO])
async def counts(
    association_id: UUID,
    request: Request,
    category: Category | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows, meta = await stock(db, actor, association_id, category)
    return {
        "data": expiry_counts(rows, meta),
        "meta": {"request_id": request.state.request_id},
    }


@router.get("/{association_id}/expiry", response_model=Page[StockLotDTO])
async def expiry(
    association_id: UUID,
    request: Request,
    view: Literal["buckets", "distribute_first"],
    category: Category | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows, meta = await stock(db, actor, association_id, category)
    rows = [row for row in rows if row["inventory_state"] == "in_stock"]
    selected, page = paginator(request).page(
        rows,
        scope={
            "actor": str(actor.id),
            "path": request.url.path,
            "category": category,
            "view": view,
            "policy": "expiry-v1",
        },
        limit=limit,
        cursor=cursor,
        preserve_order=True,
        reverse=False,
        sort_keys=("_sort",),
        expiry_day=str(meta["reference_date"]),
    )
    return {
        "data": [lot_dto(row) for row in selected],
        "page": page,
        "meta": {
            "request_id": request.state.request_id,
            "as_of": meta["as_of"],
            "policy_version": "mvp-domain-v1",
        },
    }


@router.get("/{association_id}/images", response_model=Page[GalleryDTO])
async def images(
    association_id: UUID,
    request: Request,
    category: Category | None = None,
    indicator_key: str | None = None,
    expiry_filter: Bucket | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows, meta = await stock(db, actor, association_id, category)
    rows = [
        row
        for row in rows
        if row["inventory_state"] == "in_stock"
        and (expiry_filter is None or row["expiry"]["bucket"] == expiry_filter)
        and (
            indicator_key is None
            or any(i["key"] == indicator_key for i in row["_indicators"])
        )
    ]
    selected, page = paginator(request).page(
        rows,
        scope={
            "actor": str(actor.id),
            "path": request.url.path,
            "category": category,
            "indicator": indicator_key,
            "expiry": expiry_filter,
        },
        limit=limit,
        cursor=cursor,
        preserve_order=True,
        reverse=False,
        sort_keys=("_sort",),
        expiry_day=str(meta["reference_date"]),
    )
    result = []
    for row in selected:
        photos = [
            {key: value for key, value in photo.items() if key != "uploaded_by"}
            | {
                "size_bytes": str(photo["size_bytes"]),
                "content_url": f"/api/v1/photos/{photo['id']}/content",
            }
            for photo in row["_photos"]
        ]
        indicators = [
            {
                key: i[key]
                for key in ("key", "probability", "value", "level")
                if i[key] is not None
            }
            | {
                "source": {
                    "provider": i["source_provider"],
                    "model": i["source_model"],
                    "analysis_id": i["analysis_id"],
                    "category": row["_analysis_categories"][i["analysis_id"]],
                }
            }
            for i in row["_indicators"]
        ]
        result.append({"lot": lot_dto(row), "photos": photos, "indicators": indicators})
    return {
        "data": result,
        "page": page,
        "meta": {
            "request_id": request.state.request_id,
            "as_of": meta["as_of"],
            "policy_version": "mvp-domain-v1",
        },
    }
