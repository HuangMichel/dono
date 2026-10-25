from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.analysis.schemas.models import (
    ATTRIBUTES,
    CATEGORIES,
    COMMON,
    INDICATORS,
    WireAnalysis,
)
from app.analysis.validation import evidence_conflict, indicator_level
from app.api.models import Facts


def payload(category: str = "clothes") -> dict:
    return {
        "category": category,
        "confidence": 0.9,
        "extracted": {
            "schema_version": "analysis-v1",
            "classification": {
                key: 0.9 if key == category else 0.025 for key in CATEGORIES
            },
            "attributes": {key: None for key in ATTRIBUTES[category].model_fields},
            "dates": {
                "expiry_date": None,
                "date_type": None,
                "pao_months": None,
                "date_precision": "unknown",
                "raw_label": None,
                "readability": "unknown",
            },
        },
        "indicators": [
            {"key": key, "probability": None, "value": None}
            for key in COMMON + INDICATORS[category]
        ],
    }


@pytest.mark.parametrize("category", CATEGORIES)
def test_all_five_closed_schemas(category: str) -> None:
    assert WireAnalysis.model_validate(payload(category)).category == category


@pytest.mark.parametrize(
    "probability,level",
    [
        (None, None),
        (0, "low"),
        (0.4999, "low"),
        (0.5, "medium"),
        (0.7999, "medium"),
        (0.8, "high"),
        (1, "high"),
    ],
)
def test_level_boundaries(probability: float | None, level: str | None) -> None:
    assert indicator_level(probability) == level


@pytest.mark.parametrize("probability", [-0.01, 1.01, float("nan"), float("inf"), True])
def test_invalid_probabilities(probability: object) -> None:
    data = payload()
    data["indicators"][0]["probability"] = probability
    with pytest.raises(ValidationError):
        WireAnalysis.model_validate(data)


def test_classification_ties_and_decimal_tolerance() -> None:
    data = payload()
    data["confidence"] = 0.5
    data["extracted"]["classification"] = dict(
        zip(CATEGORIES, [0.5, 0.5, 0, 0, 0], strict=False)
    )
    assert WireAnalysis.model_validate(data).category == "clothes"
    data["category"] = "shoes"
    with pytest.raises(ValidationError):
        WireAnalysis.model_validate(data)
    for total in (0.99, 1.01):
        data = payload()
        data["confidence"] = total
        data["extracted"]["classification"] = dict(
            zip(CATEGORIES, [total, 0, 0, 0, 0], strict=False)
        )
        if total <= 1:
            WireAnalysis.model_validate(data)
    data = payload()
    data["extracted"]["classification"]["food"] = 0.1
    with pytest.raises(ValidationError):
        WireAnalysis.model_validate(data)


def test_conflict_retained_and_unsupported_computed_fields_rejected() -> None:
    data = payload("shoes")
    data["extracted"]["attributes"]["pair_complete"] = True
    data["indicators"][3]["probability"] = 0.9
    original = deepcopy(data)
    result = WireAnalysis.model_validate(data)
    assert evidence_conflict(result)
    assert data == original
    data["extracted"]["dates"]["opened_on"] = "2026-01-01"
    with pytest.raises(ValidationError):
        WireAnalysis.model_validate(data)


def test_ambiguous_and_impossible_model_dates() -> None:
    data = payload("food")
    data["extracted"]["dates"].update(
        expiry_date="2026-04-03",
        date_type="DDM",
        date_precision="day",
        raw_label="03/04/2026",
        readability="readable",
    )
    with pytest.raises(ValidationError):
        WireAnalysis.model_validate(data)
    data["extracted"]["dates"].update(expiry_date="2026-02-30", raw_label="2026-02-30")
    with pytest.raises(ValidationError):
        WireAnalysis.model_validate(data)


@pytest.mark.parametrize(
    "quantity", ["no", "0", "-1", "1.1", "NaN", "Infinity", "1000000000"]
)
def test_invalid_human_quantity(quantity: str) -> None:
    with pytest.raises(ValidationError):
        Facts(quantity=quantity)
