"""Workflow response projections and scoped lookup helpers."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import Request

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor
from app.domain.errors import DomainError
from app.domain.qr import BookingProof
from app.services.workflow import (
    OfferContext,
    expiry_for,
    offer_context,
)


def projected_offer(context: OfferContext) -> dict[str, Any]:
    result = dict(context.offer)
    result["revision"], result["facts_revision"] = str(result["revision"]), str(
        result["facts_revision"]
    )
    result["quantity"] = f"{float(result['quantity']):.3f}"
    state = result["status"]
    holds_until = (
        result["review_deadline"]
        if state == "pending_review"
        else result["approval_deadline"]
    )
    if state == "approved" and context.booking:
        holds_until = context.booking["receivable_until"]
    if (
        state in ("pending_review", "approved")
        and holds_until
        and context.as_of >= datetime.fromisoformat(holds_until)
    ):
        state = "expired"
    if state not in ("pending_review", "approved"):
        holds_until = None
    from app.services.analysis import shape_analysis

    analyses = [
        shape_analysis(r["analysis"], r["indicators"], result["category"])
        for r in context.analyses
    ]
    result["computed"] = {
        "effective_state": state,
        "holds_until": holds_until,
        "expiry": expiry_for(context),
        "analysis_status": (
            "available"
            if analyses
            else (
                "pending"
                if any(r["state"] == "pending" for r in context.requests)
                else "unavailable" if context.requests else "none"
            )
        ),
        "category_mismatch": (
            any(a["category"] != result["category"] for a in analyses)
            if analyses
            else None
        ),
        "manual_review_required": not analyses
        or any(a["computed"]["manual_review_required"] for a in analyses),
    }
    return result


async def changed_offer(
    db: Supabase, actor: Actor, attempt: UUID, request: Request
) -> dict[str, object]:
    return {
        "data": projected_offer(await offer_context(db, actor, attempt)),
        "meta": {"request_id": request.state.request_id},
    }


async def booking_record(
    booking_id: UUID, actor: Actor, db: Supabase
) -> dict[str, Any]:
    rows = await db.read(
        "bookings", actor.token, {"select": "*", "id": f"eq.{booking_id}"}
    )
    if not rows:
        raise DomainError("not_found", 404)
    return rows[0]


def proof_for(booking: dict[str, Any]) -> BookingProof:
    return BookingProof(
        UUID(booking["id"]),
        UUID(booking["association_id"]),
        UUID(booking["qr_nonce"]),
        datetime.fromisoformat(booking["receivable_until"]),
    )


async def replay_lookup(
    db: Supabase, actor: Actor, key: UUID, operation: str, body: dict[str, object]
) -> dict[str, object] | None:
    row = (
        await db.command(
            "retry_lookup",
            actor.id,
            {"key": str(key), "operation": operation, "body": body},
        )
    )[0]
    if row.get("found") and isinstance(row.get("result"), dict):
        result = row["result"]
        if isinstance(result, dict):
            return result
    return None
