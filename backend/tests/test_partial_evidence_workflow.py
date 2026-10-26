"""Partial stored analyses keep review and inventory paths usable."""

from uuid import uuid4

import pytest
from test_analysis_projection import medicine_indicator, stored_analysis
from test_rule_edges import NOW, correction_context

from app.api.dependencies import Actor
from app.api.models import Facts
from app.domain.errors import DomainError
from app.services.inventory import stock
from app.services.workflow import expiry_for, guard_for


@pytest.mark.parametrize("extracted", [{}, {"attributes": {}}, {"dates": {}}])
def test_partial_offer_requires_explicit_manual_review(extracted):
    ctx = correction_context()
    ctx.need.update(active=True, seasons=[], attributes={})
    ctx.analyses = [
        {
            "analysis": stored_analysis(extracted),
            "indicators": [medicine_indicator()],
        }
    ]
    assert expiry_for(ctx)["bucket"] == "not_applicable"
    guard_for(ctx, {}, None)
    with pytest.raises(DomainError, match="ineligible_item"):
        guard_for(ctx, {"not_medicine": True}, "Checked", approval=True)
    guard_for(
        ctx,
        {"not_medicine": True, "analysis_unavailable_ack": True},
        "Staff checked the item against the photos",
        approval=True,
    )


def test_partial_offer_retains_strict_date_concern():
    ctx = correction_context()
    ctx.analyses[0]["analysis"]["extracted"] = {"dates": {"date_type": "DLC"}}
    assert expiry_for(ctx)["distribution_restriction"] == "date_clarification_required"
    with pytest.raises(DomainError, match="date_clarification_required"):
        guard_for(ctx, {}, None)


class StockDatabase:
    async def command(self, operation, actor, arguments):
        assert operation == "stock_context"
        return [
            {
                "as_of": NOW.isoformat(),
                "timezone": "Europe/Paris",
                "lots": [
                    {
                        "offer": {
                            "category": "clothes",
                            "status": "received",
                            "facts_snapshot": Facts(
                                category="clothes", quantity="1", unit="item"
                            ).model_dump(mode="json"),
                            "quantity": "1",
                            "revision": 1,
                            "facts_revision": 1,
                            "evidence_snapshot": {"analysis_request_ids": []},
                        },
                        "analyses": [stored_analysis({})],
                        "indicators": [],
                        "distributed": False,
                        "human_facts_confirmed": False,
                        "receipt": {
                            "id": str(uuid4()),
                            "donation_id": str(uuid4()),
                            "quantity": "1",
                            "created_at": NOW.isoformat(),
                        },
                        "photos": [],
                    }
                ],
            }
        ]


async def test_stock_projects_partial_original_evidence():
    rows, _ = await stock(StockDatabase(), Actor(uuid4(), "test-token"), uuid4())
    assert len(rows) == 1
    assert rows[0]["expiry"]["bucket"] == "not_applicable"
    assert rows[0]["offer"]["computed"]["manual_review_required"] is True
