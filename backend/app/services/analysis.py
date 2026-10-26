"""Fenced provider calls run outside database transactions; originals append once."""

from typing import Any
from uuid import UUID

from app.adapters.openai import OpenAIAnalyzer
from app.adapters.photos import decode_photo
from app.adapters.supabase import Supabase
from app.analysis.validation import (
    evidence_conflict,
    extraction_is_complete,
    indicator_level,
    stored_evidence_conflict,
)
from app.api.dependencies import Actor
from app.api.models import AnalysisInput
from app.domain.errors import DomainError


async def analysis_view(
    db: Supabase, actor: Actor, analysis_id: UUID
) -> dict[str, object]:
    rows = await db.read(
        "donation_analysis", actor.token, {"select": "*", "id": f"eq.{analysis_id}"}
    )
    if not rows:
        raise DomainError("not_found", 404)
    row = rows[0]
    indicators = await db.read(
        "donation_indicators",
        actor.token,
        {"select": "*", "analysis_id": f"eq.{analysis_id}", "order": "key"},
    )
    item = await db.read(
        "donations",
        actor.token,
        {"select": "category", "id": f"eq.{row['donation_id']}"},
    )
    return shape_analysis(row, indicators, item[0]["category"] if item else None)


def shape_analysis(
    row: dict[str, Any], indicators: list[dict[str, Any]], working_category: object
) -> dict[str, Any]:
    result = dict(row)
    normalized = []
    for indicator in indicators:
        value = {
            key: indicator[key]
            for key in ("key", "value", "probability", "level")
            if indicator[key] is not None
        }
        value["source"] = {
            "provider": indicator["source_provider"],
            "model": indicator["source_model"],
        }
        normalized.append(value)
    result["indicators"] = normalized
    result["input_facts_revision"] = str(result["input_facts_revision"])
    conflict = stored_evidence_conflict(result["extracted"], normalized)
    medicine = next(
        (i.get("probability") for i in normalized if i["key"] == "looks_like_medicine"),
        None,
    )
    result["computed"] = {
        "classification_status": (
            "certain" if result["confidence"] >= 0.8 else "uncertain"
        ),
        "evidence_conflict": conflict,
        "manual_review_required": conflict
        or not extraction_is_complete(result["extracted"])
        or result["confidence"] < 0.8
        or medicine is None
        or working_category != result["category"],
    }
    return result


async def run_analysis(
    db: Supabase,
    provider: OpenAIAnalyzer,
    actor: Actor,
    item: UUID,
    key: UUID,
    body: AnalysisInput,
) -> dict[str, object]:
    claim = (
        await db.command(
            "analysis_start",
            actor.id,
            {"key": str(key), "item": str(item), "body": body.model_dump(mode="json")},
        )
    )[0]
    if claim.get("replay"):
        return {
            "analysis": await analysis_view(db, actor, UUID(str(claim["resource_id"]))),
            "basis_attached": claim.get("basis_attached", False),
            "facts_seeded": claim.get("facts_seeded", False),
            "current_facts_revision": str(
                (
                    await db.read(
                        "donations",
                        actor.token,
                        {"select": "facts_revision", "id": f"eq.{item}"},
                    )
                )[0]["facts_revision"]
            ),
            "idempotent_replay": True,
        }
    context = claim["context"]
    if not isinstance(context, dict) or not isinstance(context.get("photos"), list):
        raise DomainError("database_unavailable", 503)
    try:
        images: list[tuple[str, str]] = []
        for photo in context["photos"]:
            content = (
                await db.command(
                    "photo_content", actor.id, {"photo": photo["photo_id"]}
                )
            )[0]
            metadata = content["photo"]
            if not isinstance(metadata, dict) or metadata["sha256"] != photo["sha256"]:
                raise DomainError("photo_integrity_error", 500)
            encoded = str(content["image_base64"])
            decode_photo(encoded, int(metadata["size_bytes"]), str(metadata["sha256"]))
            images.append((str(metadata["mime_type"]), encoded))
        original = await provider.analyze(images, body.category_hint)
    except DomainError as exc:
        await db.command(
            "analysis_finish",
            actor.id,
            {
                "request": claim["id"],
                "attempt": claim["attempt_id"],
                "body": {"failure_code": exc.code},
                "model": provider.settings.openai_model,
                "conflict": False,
            },
        )
        raise
    payload = original.model_dump(mode="json")
    for indicator in payload["indicators"]:
        indicator["level"] = indicator_level(indicator["probability"])
    outcome = (
        await db.command(
            "analysis_finish",
            actor.id,
            {
                "request": claim["id"],
                "attempt": claim["attempt_id"],
                "body": payload,
                "model": provider.settings.openai_model,
                "conflict": evidence_conflict(original),
            },
        )
    )[0]
    return {
        "analysis": await analysis_view(db, actor, UUID(str(outcome["id"]))),
        "basis_attached": outcome["basis_attached"],
        "facts_seeded": outcome["facts_seeded"],
        "current_facts_revision": str(
            (
                await db.read(
                    "donations",
                    actor.token,
                    {"select": "facts_revision", "id": f"eq.{item}"},
                )
            )[0]["facts_revision"]
        ),
    }
