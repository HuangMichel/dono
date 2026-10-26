"""Server-owned guard contexts; Python alone evaluates item dates and matching."""

from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.adapters.supabase import Supabase
from app.analysis.validation import extraction_is_complete, stored_evidence_conflict
from app.api.dependencies import Actor
from app.api.models import Facts
from app.domain.errors import DomainError
from app.domain.expiry import (
    SourceDates,
    calculate_expiry,
    day_fence,
    enforce_date_checks,
    has_strict_date_evidence,
)
from app.domain.matching import Budgets, attributes_match, haversine, season


class AssociationContext(BaseModel):
    id: UUID
    name: str
    display_address: str
    latitude: float
    longitude: float
    timezone: str


class NeedContext(BaseModel):
    id: UUID
    category: str
    attributes: dict[str, object]
    seasons: list[str]
    revision: int
    storage_units_per_item: int


class SlotContext(BaseModel):
    id: UUID
    starts_at: datetime
    ends_at: datetime
    quota_date: str
    intake_available: int
    remaining_places: int


class Candidate(BaseModel):
    association: AssociationContext
    need: NeedContext
    demand_available: int
    storage_available: int
    slots: list[SlotContext]


class MatchContext(BaseModel):
    as_of: datetime
    candidates: list[Candidate]


def eligible(candidate: Candidate, facts: Facts, as_of: datetime) -> list[SlotContext]:
    if not facts.quantity or facts.category != candidate.need.category:
        return []
    quantity = int(Decimal(facts.quantity))
    if (
        candidate.need.seasons
        and season(as_of, candidate.association.timezone) not in candidate.need.seasons
    ):
        return []
    if not attributes_match(candidate.need.attributes, facts.attributes):
        return []
    return [
        slot
        for slot in candidate.slots
        if Budgets(
            candidate.demand_available,
            candidate.storage_available,
            candidate.need.storage_units_per_item,
            slot.intake_available,
            slot.remaining_places,
        ).fits(quantity)
    ]


async def matches(
    db: Supabase, actor: Actor, item: UUID, facts: Facts, origin: tuple[float, float]
) -> list[dict[str, object]]:
    context = MatchContext.model_validate(
        (await db.command("match_context", actor.id, {"item": str(item)}))[0]
    )
    ranked: list[tuple[float, str, str, dict[str, object]]] = []
    for candidate in context.candidates:
        slots = eligible(candidate, facts, context.as_of)
        if not slots:
            continue
        association = candidate.association
        distance = haversine(origin, (association.latitude, association.longitude))
        ranked.append(
            (
                distance,
                str(association.id),
                str(candidate.need.id),
                {
                    "association": association.model_dump(
                        mode="json", include={"id", "name", "display_address"}
                    ),
                    "need_id": str(candidate.need.id),
                    "distance_km": distance,
                    "reasons": ["need", "storage", "season", "intake", "slot"],
                    "budgets": {
                        "demand_available": f"{candidate.demand_available:.3f}",
                        "storage_available": candidate.storage_available,
                        "storage_units_per_item": candidate.need.storage_units_per_item,
                        "intake_available": f"{slots[0].intake_available:.3f}",
                        "earliest_slot_id": str(slots[0].id),
                    },
                    "as_of": context.as_of,
                },
            )
        )
    return [result for _, _, _, result in sorted(ranked, key=lambda row: row[:3])]


async def submission_guard(
    db: Supabase, actor: Actor, item: UUID, need_id: UUID, tenant: UUID, facts: Facts
) -> dict[str, object]:
    context = MatchContext.model_validate(
        (await db.command("match_context", actor.id, {"item": str(item)}))[0]
    )
    for candidate in context.candidates:
        if (
            candidate.need.id == need_id
            and candidate.association.id == tenant
            and eligible(candidate, facts, context.as_of)
        ):
            start, end = day_fence(context.as_of, candidate.association.timezone)
            return {
                "need_revision": candidate.need.revision,
                "day_start": start.isoformat(),
                "day_end": end.isoformat(),
            }
    raise DomainError("ineligible_item", 422)


class OfferContext(BaseModel):
    """Trusted database projection used only inside the backend."""

    model_config = ConfigDict(extra="forbid")
    offer: dict[str, Any]
    as_of: datetime
    association: dict[str, Any]
    need: dict[str, Any]
    booking: dict[str, Any] | None
    slot: dict[str, Any] | None
    analyses: list[dict[str, Any]]
    requests: list[dict[str, Any]] = []
    human_facts_confirmed: bool = False
    date_label_correction_analysis_ids: list[str] = []


async def offer_context(db: Supabase, actor: Actor, attempt: UUID) -> OfferContext:
    return OfferContext.model_validate(
        (await db.command("offer_context", actor.id, {"attempt": str(attempt)}))[0]
    )


def original_strict_concern(context: OfferContext) -> bool:
    return any(
        has_strict_date_evidence(record["analysis"]["extracted"])
        for record in context.analyses
    )


def recorded_label_correction(context: OfferContext) -> bool:
    checks = context.offer.get("intake_checks") or {}
    return bool(
        context.human_facts_confirmed
        and checks.get("date_label_correction_confirmed") is True
        and sorted(context.date_label_correction_analysis_ids)
        == sorted(record["analysis"]["id"] for record in context.analyses)
    )


def expiry_for(
    context: OfferContext, *, at_time: datetime | None = None
) -> dict[str, Any]:
    facts = Facts.model_validate(context.offer["facts_snapshot"])
    strict = original_strict_concern(context)
    view = calculate_expiry(
        SourceDates(**facts.expiry.model_dump()),
        facts.category,
        as_of=at_time or context.as_of,
        timezone=context.association["timezone"],
        opening_state=str(facts.attributes.get("opening_state")),
        packaging_state=str(facts.attributes.get("packaging_state")),
        strict_evidence=strict and not recorded_label_correction(context),
    )
    return asdict(view)


def guard_for(
    context: OfferContext,
    checks: dict[str, bool],
    reason: str | None,
    *,
    approval: bool = False,
    booking_at: datetime | None = None,
) -> dict[str, object]:
    facts = Facts.model_validate(context.offer["facts_snapshot"])
    strict = original_strict_concern(context)
    correction = checks.get("date_label_correction_confirmed") is True
    if correction and (
        not context.human_facts_confirmed
        or not (reason or "").strip()
        or not original_strict_concern(context)
    ):
        raise DomainError("date_clarification_required")
    if booking_at is not None and not correction:
        correction = recorded_label_correction(context)
    view = calculate_expiry(
        SourceDates(**facts.expiry.model_dump()),
        facts.category,
        as_of=booking_at or context.as_of,
        timezone=context.association["timezone"],
        opening_state=str(facts.attributes.get("opening_state")),
        packaging_state=str(facts.attributes.get("packaging_state")),
        strict_evidence=strict and not correction,
    )
    if booking_at is None:
        enforce_date_checks(view, checks, reason)
    elif view.distribution_restriction:
        raise DomainError("intake_date_restriction")
    if approval:
        if (
            not context.need["active"]
            or (
                context.need["seasons"]
                and season(context.as_of, context.association["timezone"])
                not in context.need["seasons"]
            )
            or not attributes_match(context.need["attributes"], facts.attributes)
        ):
            raise DomainError("ineligible_item", 422)
        manual = not context.analyses
        concern = False
        for record in context.analyses:
            analysis, indicators = record["analysis"], record["indicators"]
            manual |= (
                analysis["confidence"] < 0.8 or analysis["category"] != facts.category
            )
            medicine = next(
                (
                    i["probability"]
                    for i in indicators
                    if i["key"] == "looks_like_medicine"
                ),
                None,
            )
            manual |= medicine is None
            concern |= any(
                i["key"] in ("looks_like_medicine", "chilled_or_frozen")
                and i["probability"] is not None
                and i["probability"] >= 0.5
                for i in indicators
            )
            manual |= not extraction_is_complete(analysis["extracted"])
            manual |= stored_evidence_conflict(analysis["extracted"], indicators)
        if checks.get("not_medicine") is not True or (
            facts.category == "food"
            and (
                checks.get("eligible_individual_food") is not True
                or facts.attributes.get("storage_condition") != "room_temperature"
                or facts.attributes.get("non_perishable") is not True
                or facts.attributes.get("packaging_state") == "opened"
            )
        ):
            raise DomainError("ineligible_item", 422)
        if (manual and checks.get("analysis_unavailable_ack") is not True) or (
            (manual or concern) and not (reason or "").strip()
        ):
            raise DomainError("ineligible_item", 422)
    start, end = day_fence(context.as_of, context.association["timezone"])
    return {
        "offer_revision": context.offer["revision"],
        "need_revision": context.need["revision"],
        "analysis_ids": sorted(record["analysis"]["id"] for record in context.analyses),
        "day_start": start.isoformat(),
        "day_end": end.isoformat(),
    }
