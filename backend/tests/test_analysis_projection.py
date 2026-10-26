"""Stored partial evidence stays readable and requires human review."""

from copy import deepcopy
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_analysis import payload

from app.config import Settings
from app.main import create_app
from app.services.analysis import shape_analysis


def stored_analysis(extracted):
    row = payload()
    row.update(
        id=str(uuid4()),
        donation_id=str(uuid4()),
        provider="openai",
        model="test",
        input_photos=[],
        input_facts_revision=1,
        provenance={},
        created_at="2026-10-26T12:00:00Z",
        request_id=str(uuid4()),
        extracted=extracted,
    )
    row.pop("indicators")
    return row


def medicine_indicator():
    return {
        "key": "looks_like_medicine",
        "probability": 0.01,
        "value": None,
        "level": "low",
        "source_provider": "openai",
        "source_model": "test",
    }


@pytest.mark.parametrize(
    "extracted",
    [
        {},
        {"attributes": {}},
        {"dates": {}},
        {"attributes": None, "dates": None},
        {"attributes": {}, "dates": {}},
    ],
)
def test_partial_analysis_requires_review_without_modifying_evidence(extracted):
    row = stored_analysis(extracted)
    original = deepcopy(row)
    result = shape_analysis(row, [medicine_indicator()], "clothes")
    assert result["extracted"] == extracted
    assert result["computed"]["manual_review_required"] is True
    assert result["computed"]["evidence_conflict"] is False
    assert row == original


def test_complete_analysis_keeps_existing_review_result():
    row = stored_analysis(payload()["extracted"])
    result = shape_analysis(row, [medicine_indicator()], "clothes")
    assert result["computed"]["manual_review_required"] is False
    assert result["computed"]["evidence_conflict"] is False


@pytest.mark.parametrize(
    "extracted,indicators",
    [
        ({"dates": {"raw_label": "2027-01-01 | 2028-01-01"}}, []),
        (
            {"attributes": {"pair_complete": True}},
            [
                {
                    "key": "pair_incomplete",
                    "probability": 0.9,
                    "value": None,
                    "level": "high",
                    "source_provider": "openai",
                    "source_model": "test",
                },
            ],
        ),
    ],
)
def test_conflicts_remain_visible_in_partial_evidence(extracted, indicators):
    result = shape_analysis(stored_analysis(extracted), indicators, "shoes")
    assert result["computed"]["evidence_conflict"] is True
    assert result["computed"]["manual_review_required"] is True


def test_analysis_collection_serves_partial_stored_evidence():
    row = stored_analysis({})
    actor = str(uuid4())

    def upstream(request):
        path = request.url.path
        if path == "/auth/v1/user":
            return httpx.Response(200, json={"id": actor})
        table = path.rsplit("/", 1)[-1]
        rows = {
            "profiles": [{"id": actor}],
            "donations": [{"id": row["donation_id"], "category": "clothes"}],
            "donation_analysis": [row],
            "donation_indicators": [medicine_indicator() | {"analysis_id": row["id"]}],
        }
        assert table in rows
        data = [] if int(request.url.params.get("offset", "0")) else rows[table]
        return httpx.Response(200, json=data)

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="public-test-key",
        qr_signing_key="test-qr-secret-with-more-than-32-chars",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get(
            f"/api/v1/donations/{row['donation_id']}/analyses",
            headers={"Authorization": "Bearer test-token"},
        )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["extracted"] == {}
    assert data[0]["computed"]["manual_review_required"] is True
