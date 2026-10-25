"""Account profile provisioning and owner-only reads."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor, database, enabled, subject
from app.api.models import ProfileEdit, ProfileInput
from app.api.responses import ProfileDTO, Single
from app.domain.errors import DomainError

router = APIRouter(prefix="/api/v1/account", tags=["account"])


@router.post("/profile", status_code=201, response_model=Single[ProfileDTO])
async def create_profile(
    body: ProfileInput,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(subject),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await db.command(
        "profile",
        actor.id,
        {
            "key": str(idempotency_key),
            "action": "bootstrap",
            "body": body.model_dump(mode="json"),
        },
    )
    rows[0]["revision"] = str(rows[0]["revision"])
    return {"data": rows[0], "meta": {"request_id": request.state.request_id}}


@router.get("/profile", response_model=Single[ProfileDTO])
async def read_profile(
    request: Request, actor: Actor = Depends(enabled), db: Supabase = Depends(database)
) -> dict[str, object]:
    rows = await db.read(
        "profiles",
        actor.token,
        {
            "select": "id,display_name,platform_role,revision,created_at,updated_at",
            "id": f"eq.{actor.id}",
        },
    )
    if not rows:
        raise DomainError("not_found", 404)
    rows[0]["revision"] = str(rows[0]["revision"])
    rows[0]["revision"] = str(rows[0]["revision"])
    return {"data": rows[0], "meta": {"request_id": request.state.request_id}}


@router.patch("/profile", response_model=Single[ProfileDTO])
async def edit_profile(
    body: ProfileEdit,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await db.command(
        "profile",
        actor.id,
        {
            "key": str(idempotency_key),
            "action": "edit",
            "body": body.model_dump(mode="json"),
        },
    )
    rows[0]["revision"] = str(rows[0]["revision"])
    rows[0]["revision"] = str(rows[0]["revision"])
    return {"data": rows[0], "meta": {"request_id": request.state.request_id}}
