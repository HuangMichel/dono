"""Scoped metadata collection reads and common wire projections."""

from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor
from app.api.models import Facts
from app.domain.errors import DomainError
from app.domain.expiry import SourceDates, calculate_expiry


async def all_rows(
    db: Supabase,
    actor: Actor,
    table: str,
    filters: dict[str, str] | None = None,
    select: str = "*",
) -> list[dict[str, Any]]:
    rows = []
    offset = 0
    while True:
        batch = await db.read(
            table,
            actor.token,
            {
                "select": select,
                **(filters or {}),
                "limit": "1000",
                "offset": str(offset),
            },
        )
        rows.extend(batch)
        if not batch:
            return rows
        offset += len(batch)


async def owner(db: Supabase, actor: Actor, item: UUID) -> None:
    if not await db.read(
        "donations", actor.token, {"select": "id", "id": f"eq.{item}"}
    ):
        raise DomainError("not_found", 404)


async def member(db: Supabase, actor: Actor, tenant: UUID, admin: bool = False) -> None:
    filters = {
        "select": "role",
        "association_id": f"eq.{tenant}",
        "profile_id": f"eq.{actor.id}",
        "active": "eq.true",
    }
    rows = await db.read("association_members", actor.token, filters)
    associations = await db.read(
        "associations",
        actor.token,
        {"select": "id", "id": f"eq.{tenant}", "approval_status": "eq.approved"},
    )
    if not rows or not associations or (admin and rows[0]["role"] != "assoc_admin"):
        raise DomainError("forbidden", 403)


def wire_row(row: object) -> dict[str, Any]:
    if not isinstance(row, dict):
        raise DomainError("database_unavailable", 503)
    result = dict(row)
    for key in (
        "revision",
        "facts_revision",
        "base_revision",
        "offer_revision",
        "input_facts_revision",
        "size_bytes",
    ):
        if key in result:
            result[key] = str(result[key])
    for key in ("quantity", "target_quantity", "limit_quantity"):
        if result.get(key) is not None:
            result[key] = f"{Decimal(str(result[key])):.3f}"
    return result


def photo_dto(row: dict[str, Any]) -> dict[str, Any]:
    result = wire_row(row)
    result.pop("uploaded_by", None)
    result["content_url"] = f"/api/v1/photos/{result['id']}/content"
    return result


async def donor_items(db: Supabase, actor: Actor) -> list[dict[str, Any]]:
    rows = await all_rows(db, actor, "donations")
    dates = await all_rows(db, actor, "expiry_info")
    originals = await all_rows(
        db, actor, "donation_analysis", select="donation_id,extracted"
    )
    strict_items = {
        record["donation_id"]
        for record in originals
        if record["extracted"]["dates"]["date_type"] in ("DLC", "expiry", "PAO")
        or record["extracted"]["dates"]["pao_months"] is not None
    }
    date_map = {
        row["donation_id"]: {
            key: row[key]
            for key in (
                "expiry_date",
                "date_type",
                "pao_months",
                "opened_on",
                "date_precision",
                "raw_label",
                "readability",
            )
        }
        for row in dates
    }
    summaries = (await db.command("owner_summaries", actor.id, {}))[0]
    as_of = datetime.now(UTC)
    result = []
    for row in rows:
        row = wire_row(row)
        facts = Facts.model_validate(
            {
                key: row.pop(key)
                for key in ("category", "attributes", "quantity", "unit")
            }
            | {"expiry": date_map.get(row["id"], {})}
        )
        expiry = calculate_expiry(
            SourceDates(**facts.expiry.model_dump()),
            facts.category,
            strict_evidence=row["id"] in strict_items,
            as_of=as_of,
            opening_state=str(facts.attributes.get("opening_state")),
            packaging_state=str(facts.attributes.get("packaging_state")),
        )
        row["facts"] = facts.model_dump(mode="json")
        summary = summaries.get(row["id"], {})
        if not isinstance(summary, dict):
            raise DomainError("database_unavailable", 503)
        row["computed"] = {
            "expiry": asdict(expiry),
            **summary,
        }
        result.append(row)
    return result
