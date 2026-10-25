"""Provider failures and untrusted OCR preserve manual fallback."""

import json
from datetime import date

import httpx
import pytest

from app.adapters.geocoding import BANGeocoder
from app.adapters.needs import parse_need
from app.adapters.supabase import Supabase
from app.analysis.validation import validate_printed_date
from app.config import Settings
from app.domain.errors import DomainError


@pytest.mark.parametrize(
    "case,code",
    [
        ("timeout", "provider_timeout"),
        ("network", "provider_unavailable"),
        ("busy", "provider_unavailable"),
        ("bad", "provider_invalid_output"),
        ("incomplete", "provider_unavailable"),
        ("refusal", "provider_unavailable"),
        ("multiple", "provider_invalid_output"),
        ("unit", "provider_invalid_output"),
        ("seasons", "provider_invalid_output"),
        ("orphan_attributes", "provider_invalid_output"),
    ],
)
async def test_need_parsing_failure_never_saves_a_need(case: str, code: str) -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        if case == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if case == "network":
            raise httpx.ConnectError("offline", request=request)
        if case == "busy":
            return httpx.Response(503)
        if case == "bad":
            return httpx.Response(400)
        if case == "incomplete":
            return httpx.Response(200, json={"status": "incomplete"})
        draft = {
            "category": None,
            "attributes": None,
            "seasons": None,
            "target_quantity": None,
            "unit": None,
        }
        if case == "unit":
            draft["unit"] = "kg"
        if case == "seasons":
            draft["seasons"] = ["winter", "winter"]
        if case == "orphan_attributes":
            from test_analysis import payload

            draft["attributes"] = payload()["extracted"]["attributes"]
        part = {
            "type": "output_text",
            "text": json.dumps({"draft": draft, "warnings": []}),
        }
        parts = (
            [{"type": "refusal"}]
            if case == "refusal"
            else [part, part] if case == "multiple" else [part]
        )
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [{"type": "message", "content": parts}],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
        with pytest.raises(DomainError, match=code):
            await parse_need(
                client,
                Settings(
                    _env_file=None,
                    openai_api_key="test-only",
                    openai_model="test-model",
                ),
                "untrusted input",
            )
        with pytest.raises(DomainError, match="provider_unavailable"):
            await parse_need(client, Settings(_env_file=None), "untrusted input")


@pytest.mark.parametrize(
    "raw", [None, "2027-01-23 | 2028-01-23", "01/02/2027", "24/01/2027", "no date"]
)
def test_exact_ocr_requires_one_matching_date(raw: str | None) -> None:
    with pytest.raises(ValueError):
        validate_printed_date(date(2027, 1, 23), raw)
    validate_printed_date(date(2027, 1, 23), "23/01/2027")
    validate_printed_date(date(2027, 1, 23), "DLC 2027-01-23")


@pytest.mark.parametrize(
    "body",
    [
        {"features": []},
        {
            "features": [
                {
                    "geometry": {"type": "Point", "coordinates": [181, 95]},
                    "properties": {"label": "bad"},
                }
            ]
        },
    ],
)
async def test_ban_invalid_location_fails_without_guessing(body: dict) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))
    ) as client:
        with pytest.raises(DomainError, match="geocoding_unavailable"):
            await BANGeocoder(client, "https://data.geopf.fr/geocodage/").geocode(
                "unknown address"
            )


def test_database_error_details_stay_private() -> None:
    for response in (
        httpx.Response(400, text="private SQL details"),
        httpx.Response(400, json={"message": "unrecognized internal details"}),
    ):
        with pytest.raises(DomainError, match="database_unavailable"):
            Supabase._rows(response)
    with pytest.raises(DomainError, match="duplicate_identifier"):
        Supabase._rows(
            httpx.Response(
                400, json={"code": "23505", "message": "associations_rna_uk"}
            )
        )
