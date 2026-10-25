"""Anonymous HTTP contract with deliberate Supabase/BAN transport fixtures."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.mark.parametrize("location", ["68", " 68 ", "A", "-Paris"])
def test_invalid_location_is_not_reported_as_an_outage(location: str) -> None:
    calls = []

    def upstream(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(400, json={"message": "Failed parsing query"})

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get("/api/v1/public/needs", params={"location": location})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_location"
        assert response.json()["error"]["retryable"] is False
        assert calls == []


def test_public_needs_are_available_without_a_bearer() -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/rest/v1/rpc/dono_public_needs_in_location"
        assert request.headers["apikey"] == "secret-test-key"
        assert "authorization" not in request.headers
        return httpx.Response(200, json={"data": [], "has_more": False})

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get("/api/v1/public/needs")
        assert response.status_code == 200
        assert response.json()["data"] == []
        assert response.json()["page"] == {"has_more": False, "next_cursor": None}
        assert client.get("/api/v1/account/profile").status_code == 401
        assert client.post("/api/v1/donations", json={}).status_code == 401
        assert (
            client.get(
                "/api/v1/associations/00000000-0000-0000-0000-000000000001/needs"
            ).status_code
            == 401
        )


def test_public_projection_filters_and_cursor_scope() -> None:
    import json
    from uuid import uuid4

    association, first, second = str(uuid4()), str(uuid4()), str(uuid4())
    calls = []

    def upstream(request: httpx.Request) -> httpx.Response:
        if request.url.host == "data.geopf.fr":
            assert request.url.params["q"] == "Paris"
            return httpx.Response(
                200,
                json={
                    "features": [
                        {
                            "geometry": {"type": "Point", "coordinates": [2.35, 48.85]},
                            "properties": {
                                "type": "municipality",
                                "label": "Paris",
                                "city": "Paris",
                                "postcode": "75001",
                            },
                        }
                    ]
                },
            )
        body = json.loads(request.content)
        calls.append(body)
        offset = body["page_offset"]
        assert body["filter_category"] == "clothes"
        assert body["origin_latitude"] == 48.85
        assert body["origin_longitude"] == 2.35
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": first if offset == 0 else second,
                        "association": {
                            "id": association,
                            "name": "Association",
                            "display_address": "Paris",
                            "registered_by": str(uuid4()),
                            "opening_hours": {"internal": True},
                        },
                        "category": "clothes",
                        "attributes": {"type": "coat"},
                        "seasons": [],
                        "target_quantity": "5.000",
                        "available_quantity": "4.000",
                        "unit": "item",
                        "distance_km": 1.2,
                        "source_text": "private",
                        "created_by": str(uuid4()),
                        "budgets": {"storage": 99},
                        "active": True,
                    }
                ],
                "has_more": offset == 0,
            },
        )

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
        qr_signing_key="x" * 32,
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        url = "/api/v1/public/needs?category=clothes&location=%20Paris%20&limit=1"
        response = client.get(url)
        assert response.status_code == 200
        row = response.json()["data"][0]
        assert set(row) == {
            "id",
            "association",
            "category",
            "attributes",
            "seasons",
            "target_quantity",
            "available_quantity",
            "unit",
            "distance_km",
        }
        assert set(row["association"]) == {"id", "name", "display_address"}
        cursor = response.json()["page"]["next_cursor"]
        response = client.get(url + "&cursor=" + cursor)
        assert response.status_code == 200
        assert response.json()["data"][0]["id"] == second
        assert response.json()["page"] == {"next_cursor": None, "has_more": False}
        assert [call["page_offset"] for call in calls] == [0, 1]
        assert (
            client.get(
                "/api/v1/public/needs", params={"category": "food", "cursor": cursor}
            ).status_code
            == 422
        )
        assert client.get(url + "&cursor=" + cursor + "tampered").status_code == 422


def test_blank_location_validation_and_unavailable_errors() -> None:
    import json

    def upstream(request: httpx.Request) -> httpx.Response:
        if request.url.host == "data.geopf.fr":
            assert request.url.params["type"] == "municipality"
            return httpx.Response(200, json={"features": []})
        body = json.loads(request.content)
        assert body["origin_latitude"] is None
        assert body["filter_city"] is None
        assert body["filter_postcode"] is None
        return httpx.Response(503, json={"message": "private database details"})

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        for params in ({"limit": 0}, {"limit": 51}, {"category": "medicine"}):
            assert client.get("/api/v1/public/needs", params=params).status_code == 422
        response = client.get("/api/v1/public/needs?location=%20%20")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "database_unavailable"
        assert "private database" not in response.text
        response = client.get("/api/v1/public/needs?location=unknown")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "geocoding_unavailable"


@pytest.mark.parametrize(
    ("location", "city", "expected_city", "expected_postcode"),
    [("Mulhouse", "Mulhouse", "Mulhouse", None), (" 68100 ", None, None, "68100")],
)
def test_location_search_passes_exact_locality_filter(
    location, city, expected_city, expected_postcode
) -> None:
    import json

    def upstream(request: httpx.Request) -> httpx.Response:
        if request.url.host == "data.geopf.fr":
            assert request.url.params["type"] == "municipality"
            return httpx.Response(
                200,
                json={
                    "features": [
                        {
                            "geometry": {"type": "Point", "coordinates": [7.34, 47.75]},
                            "properties": {
                                "type": "municipality",
                                "label": "68100 Mulhouse",
                                "city": city,
                                "postcode": "68100",
                            },
                        }
                    ]
                },
            )
        body = json.loads(request.content)
        assert body["filter_city"] == expected_city
        assert body["filter_postcode"] == expected_postcode
        assert body["origin_latitude"] == 47.75
        return httpx.Response(200, json={"data": [], "has_more": False})

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get("/api/v1/public/needs", params={"location": location})
        assert response.status_code == 200


@pytest.mark.parametrize("city", [None, "", "  ", 42])
def test_location_without_canonical_city_never_queries_unfiltered_needs(city) -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "data.geopf.fr"
        return httpx.Response(
            200,
            json={
                "features": [
                    {
                        "geometry": {"type": "Point", "coordinates": [7.34, 47.75]},
                        "properties": {
                            "label": "68100 Mulhouse",
                            "city": city,
                            "type": "municipality",
                        },
                    }
                ]
            },
        )

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get("/api/v1/public/needs?location=Mulhouse")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "geocoding_unavailable"


def test_town_search_requests_municipality_instead_of_same_named_street() -> None:
    import json

    def upstream(request: httpx.Request) -> httpx.Response:
        if request.url.host == "data.geopf.fr":
            municipality = request.url.params.get("type") == "municipality"
            return httpx.Response(
                200,
                json={
                    "features": [
                        {
                            "geometry": {"type": "Point", "coordinates": [7.34, 47.75]},
                            "properties": {
                                "label": "Mulhouse"
                                if municipality
                                else "mulhouse 68400 Riedisheim",
                                "city": "Mulhouse" if municipality else "Riedisheim",
                                "type": "municipality" if municipality else "street",
                            },
                        }
                    ]
                },
            )
        assert json.loads(request.content)["filter_city"] == "Mulhouse"
        return httpx.Response(200, json={"data": [], "has_more": False})

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_secret_key="secret-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        assert client.get("/api/v1/public/needs?location=Mulhouse").status_code == 200
