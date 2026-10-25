"""Owner item history and recipient-frozen evidence collections."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.adapters.supabase import Supabase
from app.api.collection_shared import page_response
from app.api.dependencies import Actor, database, enabled
from app.api.responses import (
    AnalysisDTO,
    DonationDTO,
    EditDTO,
    EvidenceDTO,
    OfferDTO,
    OfferEventDTO,
    Page,
    PhotoDTO,
    Single,
    SlotOptionDTO,
)
from app.api.workflow_shared import projected_offer
from app.services.analysis import shape_analysis
from app.services.collections import all_rows, donor_items, owner, photo_dto, wire_row
from app.services.workflow import OfferContext, offer_context

router = APIRouter(prefix="/api/v1", tags=["donation collections"])
Limit = Annotated[int, Query(ge=1, le=100)]


@router.get("/donations", response_model=Page[DonationDTO])
async def donations(
    request: Request,
    status: str | None = None,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    rows = await donor_items(db, actor)
    rows = [row for row in rows if status is None or row["status"] == status]
    return page_response(rows, request, actor, limit, cursor, {"status": status})


@router.get("/donations/{donation_id}/photos", response_model=Page[PhotoDTO])
async def photos(
    donation_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await owner(db, actor, donation_id)
    rows = await all_rows(
        db, actor, "donation_photos", {"donation_id": f"eq.{donation_id}"}
    )
    return page_response(
        [photo_dto(row) for row in rows], request, actor, limit, cursor
    )


@router.get("/donations/{donation_id}/analyses", response_model=Page[AnalysisDTO])
async def analyses(
    donation_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await owner(db, actor, donation_id)
    rows = await all_rows(
        db, actor, "donation_analysis", {"donation_id": f"eq.{donation_id}"}
    )
    indicators = await all_rows(db, actor, "donation_indicators")
    item = (
        await db.read(
            "donations", actor.token, {"select": "category", "id": f"eq.{donation_id}"}
        )
    )[0]
    result = [
        shape_analysis(
            row,
            [i for i in indicators if i["analysis_id"] == row["id"]],
            item["category"],
        )
        for row in rows
    ]
    return page_response(result, request, actor, limit, cursor)


@router.get("/donations/{donation_id}/edits", response_model=Page[EditDTO])
async def edits(
    donation_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await owner(db, actor, donation_id)
    rows = await all_rows(
        db, actor, "donation_edits", {"donation_id": f"eq.{donation_id}"}
    )
    result = []
    for row in rows:
        row = wire_row(row)
        row["before_snapshot"] = row.pop("before_facts")
        row["after_snapshot"] = row.pop("after_facts")
        result.append(row)
    return page_response(result, request, actor, limit, cursor)


@router.get("/donations/{donation_id}/offers", response_model=Page[OfferDTO])
async def offers(
    donation_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await owner(db, actor, donation_id)
    context = (
        await db.command(
            "offer_list", actor.id, {"item": str(donation_id), "tenant": None}
        )
    )[0]
    records = context.get("offers", [])
    rows = (
        [projected_offer(OfferContext.model_validate(record)) for record in records]
        if isinstance(records, list)
        else []
    )
    return page_response(rows, request, actor, limit, cursor)


@router.get("/offers/{offer_id}/events", response_model=Page[OfferEventDTO])
async def events(
    offer_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    await offer_context(db, actor, offer_id)
    rows = await all_rows(db, actor, "offer_events", {"offer_id": f"eq.{offer_id}"})
    return page_response(
        [wire_row(row) for row in rows],
        request,
        actor,
        limit,
        cursor,
        keys=("recorded_at", "id"),
    )


@router.get("/offers/{offer_id}/evidence", response_model=Single[EvidenceDTO])
async def evidence(
    offer_id: UUID,
    request: Request,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    context = await offer_context(db, actor, offer_id)
    photo_ids = {p["photo_id"] for p in context.offer["evidence_snapshot"]["photos"]}
    edit_ids = set(context.offer["evidence_snapshot"]["edit_ids"])
    photos = await all_rows(
        db,
        actor,
        "donation_photos",
        {"donation_id": f"eq.{context.offer['donation_id']}"},
    )
    edits = await all_rows(
        db,
        actor,
        "donation_edits",
        {"donation_id": f"eq.{context.offer['donation_id']}"},
    )
    shaped = [
        shape_analysis(
            record["analysis"], record["indicators"], context.offer["category"]
        )
        for record in context.analyses
    ]
    requests = context.requests
    mismatches = (
        any(row["category"] != context.offer["category"] for row in shaped)
        if shaped
        else None
    )
    for edit in edits:
        edit["before_snapshot"] = edit.pop("before_facts")
        edit["after_snapshot"] = edit.pop("after_facts")
    return {
        "data": {
            "offer_id": str(offer_id),
            "photos": [photo_dto(p) for p in photos if p["id"] in photo_ids],
            "analyses": shaped,
            "edits": [wire_row(e) for e in edits if e["id"] in edit_ids],
            "requests": requests,
            "category_mismatch": mismatches,
            "manual_review_required": not shaped
            or any(row["computed"]["manual_review_required"] for row in shaped),
            "as_of": context.as_of,
        },
        "meta": {"request_id": request.state.request_id},
    }


@router.get("/offers/{offer_id}/slots", response_model=Page[SlotOptionDTO])
async def available_slots(
    offer_id: UUID,
    request: Request,
    limit: Limit = 25,
    cursor: str | None = None,
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    from app.domain.errors import DomainError
    from app.services.workflow import guard_for

    context = await offer_context(db, actor, offer_id)
    result = (await db.command("offer_slots", actor.id, {"attempt": str(offer_id)}))[0]
    rows = []
    options = result.get("slots", [])
    if isinstance(options, list):
        for option in options:
            try:
                guard_for(
                    context,
                    {},
                    None,
                    booking_at=datetime.fromisoformat(option["starts_at"]),
                )
            except DomainError:
                continue
            rows.append(option)
    return page_response(
        rows, request, actor, limit, cursor, keys=("starts_at", "id"), reverse=False
    )
