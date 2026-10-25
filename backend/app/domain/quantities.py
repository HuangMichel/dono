"""Exact integral item quantities, independent of HTTP and provider code."""

from decimal import Decimal, InvalidOperation


def validate_quantity(value: str, *, zero: bool = False) -> str:
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("invalid quantity") from exc
    if (
        not number.is_finite()
        or number < 0
        or (not zero and number == 0)
        or number != number.to_integral_value()
        or number >= Decimal("1000000000")
    ):
        raise ValueError("invalid integral item quantity")
    return f"{number:.3f}"
