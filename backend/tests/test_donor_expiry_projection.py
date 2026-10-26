"""Owner reads tolerate absent analysis dates and retain strict evidence."""

from copy import deepcopy
from uuid import uuid4

import pytest

from app.api.dependencies import Actor
from app.services.collections import donor_items
from app.services.donations import donation_view


class DonorDatabase:
    def __init__(self, extracted):
        self.item = str(uuid4())
        self.extracted = extracted
        self.category = "clothes"
        self.dates = []

    async def read(self, table, token, query):
        if query.get("offset", "0") != "0":
            return []
        if table == "donations":
            return [
                {
                    "id": self.item,
                    "name": "Winter coat",
                    "description": None,
                    "category": self.category,
                    "attributes": {},
                    "quantity": "1",
                    "unit": "item",
                    "revision": 1,
                    "facts_revision": 1,
                }
            ]
        if table == "donation_analysis":
            return [
                {"donation_id": self.item, "extracted": {}},
                {"donation_id": self.item, "extracted": deepcopy(self.extracted)},
            ]
        if table == "expiry_info":
            rows = deepcopy(self.dates)
            if query.get("select", "*") != "*":
                return [
                    {key: row[key] for key in query["select"].split(",")}
                    for row in rows
                ]
            return rows
        return []

    async def command(self, operation, actor, arguments):
        summary = {"posting": None}
        return [{self.item: summary} if operation == "owner_summaries" else summary]


@pytest.mark.parametrize("projection", [donor_items, donation_view])
@pytest.mark.parametrize(
    "extracted,strict",
    [
        ({}, False),
        ({"dates": None}, False),
        ({"dates": {}}, False),
        ({"dates": {"date_type": "DDM", "pao_months": None}}, False),
        ({"dates": {"date_type": "DLC"}}, True),
        ({"dates": {"date_type": "expiry"}}, True),
        ({"dates": {"date_type": "PAO"}}, True),
        ({"dates": {"pao_months": 12}}, True),
    ],
)
async def test_owner_reads_preserve_available_date_evidence(
    projection, extracted, strict
):
    db = DonorDatabase(extracted)
    actor = Actor(uuid4(), "test-token")
    if projection is donor_items:
        rows = await projection(db, actor)
        assert len(rows) == 1
        row = rows[0]
    else:
        row = await projection(db, actor, db.item)
    assert row["facts"]["name"] == "Winter coat"
    expiry = row["computed"]["expiry"]
    assert expiry["bucket"] == ("unknown" if strict else "not_applicable")
    assert expiry["distribution_restriction"] == (
        "date_clarification_required" if strict else None
    )


@pytest.mark.parametrize("projection", [donor_items, donation_view])
async def test_current_strict_dates_apply_without_original_analysis_dates(projection):
    db = DonorDatabase({})
    db.category = "food"
    db.dates = [
        {
            "donation_id": db.item,
            "expiry_date": "2000-01-01",
            "date_type": "DLC",
            "pao_months": None,
            "opened_on": None,
            "date_precision": "day",
            "raw_label": "2000-01-01",
            "readability": "readable",
        }
    ]
    actor = Actor(uuid4(), "test-token")
    if projection is donor_items:
        row = (await projection(db, actor))[0]
    else:
        row = await projection(db, actor, db.item)
    expiry = row["computed"]["expiry"]
    assert expiry["bucket"] == "expired"
    assert expiry["distribution_restriction"] == "date_passed"
