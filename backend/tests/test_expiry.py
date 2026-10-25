from datetime import UTC, date, datetime, timedelta

import pytest

from app.domain.errors import DomainError
from app.domain.expiry import (
    SourceDates,
    add_months,
    calculate_expiry,
    day_fence,
    enforce_date_checks,
)

NOW = datetime(2026, 10, 25, 12, tzinfo=UTC)


@pytest.mark.parametrize(
    "days,bucket",
    [
        (-1, "expired"),
        (0, "today"),
        (1, "lt_7"),
        (6, "lt_7"),
        (7, "lt_30"),
        (29, "lt_30"),
        (30, "lt_90"),
        (89, "lt_90"),
        (90, "at_90"),
        (91, "gt_90"),
    ],
)
def test_boundaries(days: int, bucket: str) -> None:
    source = SourceDates(
        expiry_date=date(2026, 10, 25) + timedelta(days=days),
        date_type="DDM",
        date_precision="day",
        readability="readable",
    )
    result = calculate_expiry(source, "food", as_of=NOW)
    assert result.bucket == bucket
    assert result.expired is (days < 0)


@pytest.mark.parametrize(
    "start,months,expected",
    [
        ("2026-01-31", 1, "2026-02-28"),
        ("2024-01-31", 1, "2024-02-29"),
        ("2024-02-29", 12, "2025-02-28"),
    ],
)
def test_calendar_pao(start: str, months: int, expected: str) -> None:
    assert add_months(date.fromisoformat(start), months) == date.fromisoformat(expected)


def test_unknown_not_zero_and_na_distinct() -> None:
    unknown = calculate_expiry(SourceDates(), "food", as_of=NOW)
    assert (
        unknown.bucket == "unknown"
        and unknown.days_left is None
        and unknown.expired is None
    )
    assert (
        calculate_expiry(SourceDates(), "clothes", as_of=NOW).bucket == "not_applicable"
    )
    assert (
        calculate_expiry(
            SourceDates(readability="unreadable"), "food", as_of=NOW
        ).unknown_reason
        == "unreadable_date"
    )


def test_partial_ddm_leap_and_strict() -> None:
    source = SourceDates(
        raw_label="02/2024",
        date_type="DDM",
        date_precision="month",
        readability="readable",
    )
    assert calculate_expiry(source, "food", as_of=NOW).effective_expiry_date == date(
        2024, 2, 29
    )
    strict = SourceDates(
        raw_label="02/2024",
        date_type="DLC",
        date_precision="month",
        readability="readable",
    )
    assert (
        calculate_expiry(strict, "food", as_of=NOW).distribution_restriction
        == "date_clarification_required"
    )
    assert source.expiry_date is None


def test_pao_unknown_and_unopened() -> None:
    source = SourceDates(date_type="PAO", pao_months=12)
    assert (
        calculate_expiry(source, "para", as_of=NOW).unknown_reason
        == "opening_state_unknown"
    )
    assert (
        calculate_expiry(source, "para", as_of=NOW, opening_state="unopened").bucket
        == "not_applicable"
    )


def test_strict_passed_and_ddm_ack() -> None:
    for typ in ("DLC", "DDM"):
        view = calculate_expiry(
            SourceDates(
                expiry_date=date(2026, 10, 24),
                date_type=typ,
                date_precision="day",
                readability="readable",
            ),
            "food",
            as_of=NOW,
        )
        with pytest.raises(DomainError):
            enforce_date_checks(view, {}, None)
        if typ == "DDM":
            enforce_date_checks(view, {"ddm_passed_ack": True}, "Checked packaging")
        else:
            with pytest.raises(DomainError):
                enforce_date_checks(view, {"ddm_passed_ack": True}, "No bypass")


def test_dst_day_fence() -> None:
    start, end = day_fence(NOW, "Europe/Paris")
    assert (end - start).total_seconds() == 25 * 3600
    assert calculate_expiry(
        SourceDates(), "food", as_of=datetime(2026, 10, 24, 22, 30, tzinfo=UTC)
    ).reference_date == date(2026, 10, 25)
