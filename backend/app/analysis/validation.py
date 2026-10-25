"""Original normalization and conservative OCR cross-validation."""

import re
from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.analysis.schemas.models import Category, WireAnalysis


def validate_printed_date(value: date, raw: str | None) -> None:
    if raw is None or " | " in raw:
        raise ValueError("missing or conflicting exact date evidence")
    iso = re.findall(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)", raw)
    numeric = re.findall(r"(?<!\d)(\d{2})/(\d{2})/(\d{4})(?!\d)", raw)
    candidates = [date.fromisoformat(token) for token in iso]
    for day, month, year in numeric:
        if int(day) <= 12:
            raise ValueError("ambiguous numeric date requires human confirmation")
        candidates.append(date(int(year), int(month), int(day)))
    if len(candidates) != 1 or candidates[0] != value:
        raise ValueError("exact date not supported by raw evidence")


def indicator_level(probability: float | None) -> str | None:
    if probability is None:
        return None
    return "low" if probability < 0.5 else "medium" if probability < 0.8 else "high"


def evidence_conflict(result: "WireAnalysis") -> bool:
    attributes = result.extracted.attributes.model_dump()
    opposite = any(
        i.key == "pair_incomplete"
        and i.probability is not None
        and i.probability >= 0.8
        for i in result.indicators
    )
    return (attributes.get("pair_complete") is True and opposite) or " | " in (
        result.extracted.dates.raw_label or ""
    )


def normalized_indicators(
    result: "WireAnalysis", model: str
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for indicator in result.indicators:
        row: dict[str, object] = {
            "key": indicator.key,
            "source": {"provider": "openai", "model": model},
        }
        if indicator.value:
            row["value"] = indicator.value
        if indicator.probability is not None:
            row["probability"] = indicator.probability
            row["level"] = indicator_level(indicator.probability)
        rows.append(row)
    return rows


def normalize_attributes(
    category: "Category", values: dict[str, object]
) -> dict[str, object]:
    from app.analysis.schemas.models import ATTRIBUTES

    model = ATTRIBUTES[category]
    fields: dict[str, object] = {key: None for key in model.model_fields}
    fields.update(values)
    return model.model_validate(fields).model_dump()
