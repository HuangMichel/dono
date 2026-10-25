"""Bounded multipart uploads, authenticated binary reads and original analysis."""

from dataclasses import asdict
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, Request, UploadFile
from fastapi.responses import Response

from app.adapters.openai import OpenAIAnalyzer
from app.adapters.photos import decode_photo, validate_photo
from app.adapters.supabase import Supabase
from app.api.dependencies import Actor, database, enabled
from app.api.models import AnalysisInput
from app.api.responses import AnalysisResultDTO, PhotoDTO, Single
from app.services.analysis import run_analysis

router = APIRouter(prefix="/api/v1", tags=["evidence"])


@router.post(
    "/donations/{donation_id}/photos", status_code=201, response_model=Single[PhotoDTO]
)
async def upload(
    donation_id: UUID,
    request: Request,
    file: UploadFile = File(),
    kind: Literal["item", "label"] = Form(),
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    settings = request.app.state.settings
    content = await file.read(settings.photo_max_bytes + 1)
    validated = validate_photo(
        content,
        file.content_type or "",
        settings.photo_max_bytes,
        settings.photo_max_pixels,
    )
    outcome = (
        await db.command(
            "photo",
            actor.id,
            {
                "key": str(idempotency_key),
                "item": str(donation_id),
                "body": asdict(validated) | {"kind": kind},
            },
        )
    )[0]
    rows = await db.read(
        "donation_photos",
        actor.token,
        {
            "select": "id,donation_id,mime_type,size_bytes,sha256,kind,created_at",
            "id": f"eq.{outcome['id']}",
        },
    )
    rows[0]["size_bytes"] = str(rows[0]["size_bytes"])
    rows[0]["content_url"] = f"/api/v1/photos/{outcome['id']}/content"
    return {
        "data": rows[0],
        "meta": {
            "request_id": request.state.request_id,
            "idempotent_replay": outcome["replay"],
        },
    }


@router.get("/photos/{photo_id}/content")
async def content(
    photo_id: UUID, actor: Actor = Depends(enabled), db: Supabase = Depends(database)
) -> Response:
    from app.domain.errors import DomainError

    row = (await db.command("photo_content", actor.id, {"photo": str(photo_id)}))[0]
    metadata = row["photo"]
    if not isinstance(metadata, dict):
        raise DomainError("photo_integrity_error", 500)
    raw = decode_photo(
        str(row["image_base64"]), int(metadata["size_bytes"]), str(metadata["sha256"])
    )
    return Response(
        raw,
        media_type=str(metadata["mime_type"]),
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post(
    "/donations/{donation_id}/analyses",
    status_code=201,
    response_model=Single[AnalysisResultDTO],
)
async def analyze(
    donation_id: UUID,
    body: AnalysisInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    provider = OpenAIAnalyzer(request.app.state.http, request.app.state.settings)
    result = await run_analysis(db, provider, actor, donation_id, idempotency_key, body)
    return {"data": result, "meta": {"request_id": request.state.request_id}}
