"""Acceptance edges: audited corrections, PAO, FEFO and scoped cursors."""

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from app.api.models import Facts
from app.domain.errors import DomainError
from app.domain.expiry import SourceDates, calculate_expiry, fefo_key, partial_date
from app.domain.qr import BookingProof, QRSigner
from app.services.pagination import CursorPages
from app.services.workflow import (
    OfferContext,
    expiry_for,
    guard_for,
    recorded_label_correction,
)

NOW = datetime(2026, 10, 25, 12, tzinfo=UTC)


def correction_context(facts: Facts | None = None) -> OfferContext:
    facts = facts or Facts(category="clothes", quantity="1", unit="item")
    return OfferContext(
        offer={
            "facts_snapshot": facts.model_dump(mode="json"),
            "revision": 1,
            "intake_checks": {},
        },
        as_of=NOW,
        association={"timezone": "Europe/Paris", "revision": 1},
        need={"revision": 1},
        booking=None,
        slot=None,
        human_facts_confirmed=True,
        analyses=[
            {
                "analysis": {
                    "id": "evidence-1",
                    "extracted": {"dates": {"date_type": "DLC", "pao_months": None}},
                }
            }
        ],
    )


def test_false_label_correction_is_explicit_audited_and_bound_to_evidence() -> None:
    ctx = correction_context()
    assert expiry_for(ctx)["distribution_restriction"] == "date_clarification_required"
    for checks, reason in (
        ({}, None),
        ({"date_label_correction_confirmed": True}, None),
    ):
        with pytest.raises(DomainError):
            guard_for(ctx, checks, reason)
    checks = {"date_label_correction_confirmed": True}
    guard_for(ctx, checks, "Verified: printed text is a reference, not a date")
    ctx.human_facts_confirmed = False
    with pytest.raises(DomainError):
        guard_for(ctx, checks, "Unconfirmed facts cannot be used")
    ctx.human_facts_confirmed = True
    ctx.offer["intake_checks"] = checks
    ctx.date_label_correction_analysis_ids = ["evidence-1"]
    assert recorded_label_correction(ctx)
    assert expiry_for(ctx)["bucket"] == "not_applicable"
    guard_for(ctx, {}, None, booking_at=NOW)
    ctx.date_label_correction_analysis_ids = []
    assert not recorded_label_correction(ctx)
    with pytest.raises(DomainError):
        guard_for(ctx, {}, None, booking_at=NOW)


@pytest.mark.parametrize(
    "dates",
    [
        {
            "date_type": "DLC",
            "expiry_date": "2026-10-24",
            "date_precision": "day",
            "readability": "readable",
        },
        {"date_type": "DLC"},
    ],
)
def test_correction_never_bypasses_current_strict_source_facts(dates: dict) -> None:
    ctx = correction_context(
        Facts(category="food", quantity="1", unit="item", expiry=dates)
    )
    with pytest.raises(DomainError):
        guard_for(
            ctx, {"date_label_correction_confirmed": True}, "Correction assertion"
        )


@pytest.mark.parametrize(
    "opening,opened,months,reason",
    [
        ("opened", None, 12, "opening_date_missing"),
        ("opened", date(2026, 10, 26), 12, "invalid_opening_date"),
        ("opened", date(2026, 1, 1), None, "pao_duration_missing"),
    ],
)
def test_incomplete_pao_remains_restricted(
    opening: str, opened: date | None, months: int | None, reason: str
) -> None:
    view = calculate_expiry(
        SourceDates(date_type="PAO", pao_months=months, opened_on=opened),
        "para",
        as_of=NOW,
        opening_state=opening,
    )
    assert view.unknown_reason == reason
    assert view.distribution_restriction == "date_clarification_required"


def test_pao_earliest_date_and_total_fefo_order() -> None:
    view = calculate_expiry(
        SourceDates(
            date_type="expiry",
            expiry_date=date(2027, 1, 1),
            date_precision="day",
            readability="readable",
            pao_months=2,
            opened_on=date(2026, 9, 30),
        ),
        "para",
        as_of=NOW,
        opening_state="opened",
        stock=True,
    )
    assert view.effective_expiry_date == date(2026, 11, 30)
    assert view.date_basis == "earliest_limit"
    pao = calculate_expiry(
        SourceDates(date_type="PAO", pao_months=1, opened_on=date(2026, 9, 1)),
        "para",
        as_of=NOW,
        opening_state="opened",
        stock=True,
    )
    unknown = calculate_expiry(SourceDates(), "food", as_of=NOW, stock=True)
    na = calculate_expiry(SourceDates(), "clothes", as_of=NOW, stock=True)
    ordered = sorted(
        [pao, na, unknown, view], key=lambda row: fefo_key(row, NOW, "same-item")
    )
    assert ordered == [view, unknown, na, pao]
    assert partial_date(
        SourceDates(
            raw_label="2028",
            date_type="DDM",
            date_precision="year",
            readability="readable",
        ),
        "food",
    ) == date(2028, 12, 31)
    assert (
        partial_date(
            SourceDates(
                raw_label="2028-13",
                date_type="expiry",
                date_precision="month",
                readability="readable",
            ),
            "para",
        )
        is None
    )
    with pytest.raises(ValueError):
        calculate_expiry(SourceDates(), "food", as_of=NOW.replace(tzinfo=None))
    with pytest.raises(ValueError):
        fefo_key(calculate_expiry(SourceDates(), "food", as_of=NOW), NOW, "item")


def test_cursor_identity_filters_midnight_and_deleted_anchor() -> None:
    pages = CursorPages("test-only-key-that-is-at-least-32-characters")
    rows = [{"id": str(i), "created_at": f"2026-01-0{i}"} for i in range(1, 5)]
    selected, page = pages.page(
        rows, scope={"actor": "a"}, limit=2, cursor=None, expiry_day="2026-10-25"
    )
    assert [r["id"] for r in selected] == ["4", "3"]
    cursor = str(page["next_cursor"])
    selected, page = pages.page(
        [r for r in rows if r["id"] != "3"],
        scope={"actor": "a"},
        limit=2,
        cursor=cursor,
        expiry_day="2026-10-25",
    )
    assert [r["id"] for r in selected] == ["2", "1"]
    for token, scope, day, code in (
        (cursor + "x", {"actor": "a"}, "2026-10-25", "invalid_cursor"),
        (cursor, {"actor": "b"}, "2026-10-25", "invalid_cursor"),
        (cursor, {"actor": "a"}, "2026-10-26", "stale_cursor"),
    ):
        with pytest.raises(DomainError, match=code):
            pages.page(rows, scope=scope, limit=2, cursor=token, expiry_day=day)
    with pytest.raises(DomainError):
        pages.page(rows, scope={}, limit=0, cursor=None)
    with pytest.raises(DomainError, match="cursor_unavailable"):
        CursorPages("").page(rows, scope={}, limit=1, cursor=None)


def test_qr_decode_rejects_forgery_and_normalizes_timezone() -> None:
    signer = QRSigner("test-only-key-that-is-at-least-32-characters")
    proof = BookingProof(uuid4(), uuid4(), uuid4(), NOW)
    assert signer.decode(signer.sign(proof)) == proof
    with pytest.raises(DomainError, match="invalid_qr"):
        signer.decode("tampered.payload")
    with pytest.raises(DomainError, match="qr_unavailable"):
        QRSigner("").decode("anything")
    with pytest.raises(DomainError, match="qr_unavailable"):
        QRSigner("").sign(proof)
