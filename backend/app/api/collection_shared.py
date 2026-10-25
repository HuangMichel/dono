"""HTTP metadata pagination shared by explicit collection endpoints."""

from datetime import UTC, datetime
from typing import Any

from fastapi import Request

from app.api.dependencies import Actor
from app.services.pagination import CursorPages


def page_response(
    rows: list[dict[str, Any]],
    request: Request,
    actor: Actor,
    limit: int,
    cursor: str | None,
    filters: dict[str, object] | None = None,
    keys: tuple[str, ...] = ("created_at", "id"),
    reverse: bool = True,
) -> dict[str, Any]:
    selected, page = CursorPages(
        request.app.state.settings.qr_signing_key.get_secret_value()
    ).page(
        rows,
        scope={"actor": str(actor.id), "path": request.url.path, **(filters or {})},
        limit=limit,
        cursor=cursor,
        sort_keys=keys,
        reverse=reverse,
    )
    return {
        "data": selected,
        "page": page,
        "meta": {
            "request_id": request.state.request_id,
            "as_of": datetime.now(UTC),
            "policy_version": "mvp-domain-v1",
        },
    }
