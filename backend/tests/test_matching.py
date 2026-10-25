from datetime import UTC, datetime

from app.domain.matching import Budgets, attributes_match, haversine, season


def test_independent_budgets() -> None:
    assert not Budgets(10, 6, 2, 2, 1).fits(3)
    assert Budgets(10, 6, 2, 2, 1).fits(1)
    assert not Budgets(0, 6, 2, 2, 1).fits(1)
    assert not Budgets(10, 0, 2, 2, 1).fits(1)
    assert not Budgets(10, 6, 2, 2, 0).fits(1)


def test_distance_and_season_and_attributes() -> None:
    paris = (48.8566, 2.3522)
    assert haversine(paris, paris) == 0
    assert haversine(paris, (48.86, 2.35)) < haversine(paris, (45.76, 4.83))
    assert season(datetime(2026, 10, 25, tzinfo=UTC), "Europe/Paris") == "autumn"
    assert not attributes_match({"size": "M"}, {"size": "L"})
    assert attributes_match({"size": None}, {"size": "M"})
