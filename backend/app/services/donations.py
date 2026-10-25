"""Owner donation projections keep source facts separate from computed values."""

from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from app.adapters.supabase import Supabase
from app.api.dependencies import Actor
from app.api.models import Facts
from app.domain.errors import DomainError
from app.domain.expiry import SourceDates, calculate_expiry


async def donation_view(db: Supabase, actor: Actor, item: UUID) -> dict[str, object]:
    rows = await db.read("donations", actor.token, {"select": "*", "id": f"eq.{item}"})
    if not rows:
        raise DomainError("not_found", 404)
    row = rows[0]
    dates = await db.read(
        "expiry_info",
        actor.token,
        {
            "select": (
                "expiry_date,date_type,pao_months,opened_on,"
                "date_precision,raw_label,readability"
            ),
            "donation_id": f"eq.{item}",
        },
    )
    if row.get("quantity") is not None:
        row["quantity"] = str(row["quantity"])
    facts = Facts.model_validate(
        {
            key: row.get(key)
            for key in (
                "name",
                "description",
                "category",
                "attributes",
                "quantity",
                "unit",
            )
        }
        | {"expiry": dates[0] if dates else {}}
    )
    for key in ("name", "description", "category", "attributes", "quantity", "unit"):
        row.pop(key, None)
    row["facts"] = facts.model_dump(mode="json")
    row["revision"], row["facts_revision"] = (
        str(row["revision"]),
        str(row["facts_revision"]),
    )
    originals = await db.read(
        "donation_analysis",
        actor.token,
        {"select": "extracted", "donation_id": f"eq.{item}"},
    )
    strict = any(
        cast(dict[str, Any], record["extracted"])["dates"]["date_type"]
        in ("DLC", "expiry", "PAO")
        or cast(dict[str, Any], record["extracted"])["dates"]["pao_months"] is not None
        for record in originals
    )
    view = calculate_expiry(
        SourceDates(**facts.expiry.model_dump()),
        facts.category,
        strict_evidence=strict,
        as_of=datetime.now(UTC),
        opening_state=str(facts.attributes.get("opening_state")),
        packaging_state=str(facts.attributes.get("packaging_state")),
    )
    # The active-offer/stock projection is added with transactional offer commands.
    summary = (await db.command("item_summary", actor.id, {"item": str(item)}))[0]
    row["posting"] = summary.pop("posting", None)
    row["computed"] = {"expiry": asdict(view), **summary}
    return row
