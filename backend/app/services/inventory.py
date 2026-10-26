"""Read-time stock, counts and total FEFO; metadata only, never image payloads."""

from dataclasses import asdict
from datetime import date, datetime
from typing import Any
from uuid import UUID

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor
from app.api.models import Facts
from app.domain.errors import DomainError
from app.domain.expiry import (
    BUCKETS,
    SourceDates,
    calculate_expiry,
    fefo_key,
    has_strict_date_evidence,
)


async def stock(
    db: Supabase, actor: Actor, tenant: UUID, category: str | None = None
) -> tuple[list[dict[str, Any]], dict[str, object]]:
    context = (await db.command("stock_context", actor.id, {"tenant": str(tenant)}))[0]
    lots = context.get("lots")
    if not isinstance(lots, list):
        raise DomainError("database_unavailable", 503)
    as_of = datetime.fromisoformat(str(context["as_of"]))
    timezone = str(context["timezone"])
    rows = []
    for record in lots:
        offer = record["offer"]
        if category and offer["category"] != category:
            continue
        facts = Facts.model_validate(offer["facts_snapshot"])
        strict = any(
            has_strict_date_evidence(a["extracted"])
            for a in record["analyses"]
        )
        view = calculate_expiry(
            SourceDates(**facts.expiry.model_dump()),
            facts.category,
            as_of=as_of,
            timezone=timezone,
            opening_state=str(facts.attributes.get("opening_state")),
            packaging_state=str(facts.attributes.get("packaging_state")),
            strict_evidence=strict
            and not (
                record["human_facts_confirmed"]
                and (offer.get("intake_checks") or {}).get(
                    "date_label_correction_confirmed"
                )
                is True
                and sorted(record["date_label_correction_analysis_ids"])
                == sorted(a["id"] for a in record["analyses"])
            ),
            stock=not record["distributed"],
        )
        receipt = record["receipt"]
        receipt["quantity"] = f"{float(receipt['quantity']):.3f}"
        offer["quantity"] = f"{float(offer['quantity']):.3f}"
        offer["revision"], offer["facts_revision"] = str(offer["revision"]), str(
            offer["facts_revision"]
        )
        from app.services.analysis import shape_analysis

        originals = [
            shape_analysis(
                a,
                [i for i in record["indicators"] if i["analysis_id"] == a["id"]],
                offer["category"],
            )
            for a in record["analyses"]
        ]
        offer["computed"] = {
            "effective_state": offer["status"],
            "holds_until": None,
            "expiry": asdict(view) | {"fefo_group": None},
            "analysis_status": (
                "available"
                if originals
                else (
                    "unavailable"
                    if offer["evidence_snapshot"]["analysis_request_ids"]
                    else "none"
                )
            ),
            "manual_review_required": not originals
            or any(a["computed"]["manual_review_required"] for a in originals),
            "category_mismatch": (
                any(a["category"] != offer["category"] for a in originals)
                if originals
                else None
            ),
        }
        rows.append(
            {
                "id": receipt["id"],
                "created_at": receipt["created_at"],
                "receipt": receipt,
                "offer": offer,
                "inventory_state": (
                    "distributed" if record["distributed"] else "in_stock"
                ),
                "remaining_quantity": (
                    "0.000" if record["distributed"] else receipt["quantity"]
                ),
                "expiry": asdict(view),
                "_sort": (
                    fefo_key(
                        view,
                        datetime.fromisoformat(receipt["created_at"]),
                        receipt["donation_id"],
                    )
                    if view.fefo_group is not None
                    else (
                        4,
                        date.max,
                        datetime.fromisoformat(receipt["created_at"]),
                        receipt["donation_id"],
                    )
                ),
                "_photos": record["photos"],
                "_analysis_categories": {
                    a["id"]: a["category"] for a in record["analyses"]
                },
                "_indicators": record["indicators"],
            }
        )
    rows.sort(key=lambda row: row["_sort"])
    reference = calculate_expiry(
        SourceDates(), None, as_of=as_of, timezone=timezone
    ).reference_date.isoformat()
    return rows, {
        "as_of": as_of.isoformat(),
        "timezone": timezone,
        "reference_date": reference,
        "policy_version": "expiry-v1",
    }


def expiry_counts(
    rows: list[dict[str, Any]], meta: dict[str, object]
) -> dict[str, object]:
    received = [row for row in rows if row["inventory_state"] == "in_stock"]
    counts = {
        key: sum(row["expiry"]["bucket"] == key for row in received) for key in BUCKETS
    }
    return {
        "scope": "received_undistributed",
        **meta,
        "buckets": [{"key": key, "count": value} for key, value in counts.items()],
        "expired_count": counts["expired"],
        "unknown_count": counts["unknown"],
        "not_applicable_count": counts["not_applicable"],
        "unreadable_count": sum(
            row["expiry"]["unknown_reason"] == "unreadable_date" for row in received
        ),
    }


def lot_dto(row: dict[str, Any]) -> dict[str, object]:
    return {
        key: value
        for key, value in row.items()
        if key not in ("id", "created_at") and not key.startswith("_")
    }
