"""expiry-v1: calendar calculations from source facts, never persisted."""

import re
from calendar import monthrange
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from app.domain.errors import DomainError

Bucket = Literal[
    "expired",
    "today",
    "lt_7",
    "lt_30",
    "lt_90",
    "at_90",
    "gt_90",
    "unknown",
    "not_applicable",
]
BUCKETS: tuple[Bucket, ...] = (
    "expired",
    "today",
    "lt_7",
    "lt_30",
    "lt_90",
    "at_90",
    "gt_90",
    "unknown",
    "not_applicable",
)


@dataclass(frozen=True, slots=True)
class SourceDates:
    expiry_date: date | None = None
    raw_label: str | None = None
    date_type: str | None = None
    pao_months: int | None = None
    opened_on: date | None = None
    date_precision: str = "unknown"
    readability: str = "unknown"


@dataclass(frozen=True, slots=True)
class ExpiryView:
    as_of: datetime
    timezone: str
    reference_date: date
    effective_expiry_date: date | None
    days_left: int | None
    expired: bool | None
    bucket: Bucket
    unknown_reason: str | None
    date_basis: str
    required_date_checks: tuple[str, ...]
    distribution_restriction: str | None
    fefo_group: int | None
    policy_version: str = "expiry-v1"


def add_months(value: date, months: int) -> date:
    """Preserve day, clamping only when the target month is shorter."""
    year, month = divmod(value.year * 12 + value.month - 1 + months, 12)
    month += 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def date_bucket(days: int) -> Bucket:
    if days < 0:
        return "expired"
    if days == 0:
        return "today"
    if days < 7:
        return "lt_7"
    if days < 30:
        return "lt_30"
    if days < 90:
        return "lt_90"
    return "at_90" if days == 90 else "gt_90"


def partial_date(source: SourceDates, category: str) -> date | None:
    if source.readability != "readable":
        return None
    if source.date_type != "DDM" and not (
        category == "para" and source.date_type == "expiry"
    ):
        return None
    label = re.sub(r"\s+", " ", (source.raw_label or "").strip().lower())
    label = re.sub(
        r"^(à consommer de préférence avant fin|best before end|"
        r"à utiliser avant fin)\s*:?\s*",
        "",
        label,
    )
    if source.date_precision == "month":
        match = re.fullmatch(r"(\d{2})/(\d{4})|(\d{4})-(\d{2})", label)
        if match:
            month = int(match[1] or match[4])
            year = int(match[2] or match[3])
            if 1 <= year <= 9999 and 1 <= month <= 12:
                return date(year, month, monthrange(year, month)[1])
    if (
        source.date_precision == "year"
        and source.date_type == "DDM"
        and re.fullmatch(r"\d{4}", label)
    ):
        year = int(label)
        if year:
            return date(year, 12, 31)
    return None


def calculate_expiry(
    source: SourceDates,
    category: str | None,
    *,
    as_of: datetime,
    timezone: str = "Europe/Paris",
    opening_state: str | None = None,
    packaging_state: str | None = None,
    strict_evidence: bool = False,
    stock: bool = False,
) -> ExpiryView:
    """Compute one exclusive bucket, restrictions and optional stock group."""
    if as_of.tzinfo is None:
        raise ValueError("as_of must be timezone-aware")
    reference = as_of.astimezone(ZoneInfo(timezone)).date()
    strict = (
        strict_evidence
        or source.date_type in ("DLC", "expiry", "PAO")
        or source.pao_months is not None
    )
    absolute = (
        source.expiry_date
        if source.date_precision == "day" and source.readability == "readable"
        else None
    )
    if absolute is None:
        absolute = partial_date(source, category or "")
    basis = "exact" if source.expiry_date and absolute else "period_end"
    reason: str | None = None
    na = False
    known_strict_passed = (
        strict
        and source.date_type != "DDM"
        and absolute is not None
        and absolute < reference
    )
    has_dates = any(
        (
            source.expiry_date,
            source.raw_label,
            source.date_type,
            source.pao_months,
            source.opened_on,
        )
    )
    if category not in ("food", "para"):
        if has_dates or strict_evidence:
            reason = "category_date_conflict"
        else:
            na, basis = True, "not_applicable"
    elif category == "food" and packaging_state == "opened":
        reason = "opened_food"
    else:
        if source.raw_label and " | " in source.raw_label:
            reason = "conflicting_dates"
        elif source.readability == "unreadable":
            reason = "unreadable_date"
        elif (
            source.expiry_date is None
            and source.date_precision == "unknown"
            and source.raw_label
            and source.date_type != "PAO"
        ):
            reason = "ambiguous_date"
        elif source.date_type is None:
            reason = "date_type_unknown" if has_dates else "missing_date"
        elif source.date_type != "PAO" and absolute is None:
            reason = "incomplete_strict_date" if strict else "missing_date"
        if category == "para" and (
            source.pao_months is not None or source.date_type == "PAO"
        ):
            if opening_state == "unopened":
                if source.date_type == "PAO" and absolute is None:
                    na, reason, basis = True, None, "pao_unopened"
            elif opening_state != "opened":
                reason = "opening_state_unknown"
            elif source.opened_on is None:
                reason = "opening_date_missing"
            elif source.opened_on > reference:
                reason = "invalid_opening_date"
            elif source.pao_months is None:
                reason = "pao_duration_missing"
            else:
                pao = add_months(source.opened_on, source.pao_months)
                known_strict_passed = known_strict_passed or pao < reference
                if source.date_type == "PAO":
                    absolute, reason, basis = pao, None, "pao"
                elif reason is None and absolute is not None:
                    absolute, basis = min(absolute, pao), "earliest_limit"
    if reason or na:
        effective, days, expired = None, None, None
        bucket: Bucket = "not_applicable" if na else "unknown"
        if not na:
            basis = "unknown"
    else:
        effective = absolute
        if effective is None:
            raise ValueError("missing effective source")
        days = (effective - reference).days
        expired = days < 0
        bucket = date_bucket(days)
    restriction = None
    checks: tuple[str, ...] = ()
    if known_strict_passed or (
        strict and expired is True and source.date_type != "DDM"
    ):
        restriction = "date_passed"
    elif reason == "opened_food":
        restriction = "opened_food"
    elif reason and strict:
        restriction = "date_clarification_required"
    elif reason:
        checks = ("date_review_ack",)
    elif source.date_type == "DDM" and expired:
        checks = ("ddm_passed_ack",)
    group = (
        (3 if restriction else 1 if bucket == "unknown" else 2 if na else 0)
        if stock
        else None
    )
    return ExpiryView(
        as_of,
        timezone,
        reference,
        effective,
        days,
        expired,
        bucket,
        reason,
        basis,
        checks,
        restriction,
        group,
    )


def enforce_date_checks(
    view: ExpiryView, checks: dict[str, bool], reason: str | None
) -> None:
    """Reject physical effects without changing any item or human decision."""
    if view.distribution_restriction:
        code = (
            "date_clarification_required"
            if view.distribution_restriction == "date_clarification_required"
            else "intake_date_restriction"
        )
        raise DomainError(code)
    if any(checks.get(key) is not True for key in view.required_date_checks) or (
        view.required_date_checks and not (reason or "").strip()
    ):
        raise DomainError("date_clarification_required")


def day_fence(as_of: datetime, timezone: str) -> tuple[datetime, datetime]:
    zone = ZoneInfo(timezone)
    local = as_of.astimezone(zone)
    start = datetime.combine(local.date(), datetime.min.time(), zone)
    end = datetime.combine(local.date() + timedelta(days=1), datetime.min.time(), zone)
    return start.astimezone(UTC), end.astimezone(UTC)


def fefo_key(
    view: ExpiryView, received_at: datetime, donation_id: str
) -> tuple[int, date, datetime, str]:
    if view.fefo_group is None:
        raise ValueError("FEFO requires received stock")
    return (
        view.fefo_group,
        view.effective_expiry_date or date.max,
        received_at,
        donation_id,
    )
