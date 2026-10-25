"""Deterministic eligibility and stable geographic ordering, without AI."""

from dataclasses import dataclass
from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo


def haversine(origin: tuple[float, float], target: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(radians, (*origin, *target))
    a = (
        sin((lat2 - lat1) / 2) ** 2
        + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    )
    return 6371.0088 * 2 * asin(sqrt(min(1.0, a)))


def season(as_of: datetime, timezone: str) -> str:
    month = as_of.astimezone(ZoneInfo(timezone)).month
    return (
        "winter"
        if month in (12, 1, 2)
        else "spring" if month <= 5 else "summer" if month <= 8 else "autumn"
    )


@dataclass(frozen=True, slots=True)
class Budgets:
    demand_available: int
    storage_available: int
    storage_units_per_item: int
    intake_available: int
    remaining_places: int

    def fits(self, quantity: int) -> bool:
        return (
            quantity > 0
            and self.storage_units_per_item > 0
            and self.demand_available >= quantity
            and self.storage_available >= quantity * self.storage_units_per_item
            and self.intake_available >= quantity
            and self.remaining_places > 0
        )


def attributes_match(criteria: dict[str, object], facts: dict[str, object]) -> bool:
    return all(
        value is None or facts.get(key) == value for key, value in criteria.items()
    )
