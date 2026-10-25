"""Discovery HTTP contracts with deliberate database transport substitutes."""

import base64
import json
from hashlib import sha256
from io import BytesIO
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app


def configuration():
    return Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="test-public",
        supabase_secret_key="test-secret",
        qr_signing_key="x" * 32,
    )


def test_nearby_pagination_signed_scope_and_dependency_errors():
    actor, tenant, item = map(str, (uuid4(), uuid4(), uuid4()))
    calls = []

    def upstream(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": actor})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": actor}])
        body = json.loads(request.content)
        assert body["actor"] == actor and body["tenant"] == tenant
        calls.append(body)
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": item,
                        "category": "clothes",
                        "attributes": {"type": "coat"},
                        "quantity": "1.000",
                        "unit": "item",
                        "expiry": {"raw_label": "private label"},
                        "indicators": [],
                        "photos": [],
                        "posted_at": "2026-10-25T12:00:00Z",
                        "locality": "Paris",
                        "distance_km": 1.2,
                        "donor_id": "must never expose",
                    }
                ],
                "has_more": body["page_offset"] == 0,
                "as_of": "2026-10-25T12:00:00Z",
            },
        )

    with TestClient(
        create_app(configuration(), httpx.MockTransport(upstream))
    ) as client:
        url = f"/api/v1/associations/{tenant}/posted-donations"
        assert client.get(url).status_code == 401
        headers = {"Authorization": "Bearer test"}
        response = client.get(
            url, params={"limit": 1, "category": "clothes"}, headers=headers
        )
        assert response.status_code == 200
        assert "donor_id" not in response.json()["data"][0]
        assert "raw_label" not in response.json()["data"][0]["expiry"]
        cursor = response.json()["page"]["next_cursor"]
        assert (
            client.get(
                url, params={"cursor": cursor, "category": "food"}, headers=headers
            ).status_code
            == 422
        )
        response = client.get(
            url,
            params={"cursor": cursor, "category": "clothes", "limit": 1},
            headers=headers,
        )
        assert (
            response.status_code == 200 and response.json()["page"]["has_more"] is False
        )
        assert [call["page_offset"] for call in calls] == [0, 1]
        assert (
            client.get(url, params={"radius_km": "nan"}, headers=headers).status_code
            == 422
        )


def test_discovery_photo_strips_metadata_and_keeps_original():
    actor, tenant, item, photo = map(str, (uuid4(), uuid4(), uuid4(), uuid4()))
    image = Image.new("RGB", (8, 4), "red")
    exif = Image.Exif()
    exif[0x010F] = "Private camera owner"
    exif[0x0112] = 6
    exif[0x9286] = b"GPS personal metadata"
    output = BytesIO()
    image.save(output, format="JPEG", exif=exif, xmp=b"<private>coordinates</private>")
    original = output.getvalue()

    def upstream(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": actor})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": actor}])
        assert request.url.path == "/rest/v1/rpc/dono_posted_photo"
        return httpx.Response(
            200,
            json={
                "photo": {
                    "mime_type": "image/jpeg",
                    "size_bytes": len(original),
                    "sha256": sha256(original).hexdigest(),
                },
                "image_base64": base64.b64encode(original).decode(),
            },
        )

    with TestClient(
        create_app(configuration(), httpx.MockTransport(upstream))
    ) as client:
        response = client.get(
            f"/api/v1/associations/{tenant}/posted-donations/{item}/photos/{photo}/content",
            headers={"Authorization": "Bearer test"},
        )
        assert response.status_code == 200
        with Image.open(BytesIO(response.content)) as shared:
            assert not shared.getexif()
            assert not shared.info
            assert shared.size == (4, 8)
        assert b"Private camera owner" not in response.content
        assert b"coordinates" not in response.content
        with Image.open(BytesIO(original)) as evidence:
            assert evidence.getexif()[0x010F] == "Private camera owner"
        assert response.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize(
    "code,status",
    [("association_location_required", 422), ("forbidden", 403), ("not_found", 404)],
)
def test_nearby_database_errors_are_actionable(code, status):
    actor, tenant = map(str, (uuid4(), uuid4()))

    def upstream(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": actor})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": actor}])
        return httpx.Response(400, json={"message": code})

    with TestClient(
        create_app(configuration(), httpx.MockTransport(upstream))
    ) as client:
        response = client.get(
            f"/api/v1/associations/{tenant}/posted-donations",
            headers={"Authorization": "Bearer test"},
        )
        assert response.status_code == status
        assert response.json()["error"]["code"] == code


def test_donor_collection_and_detail_preserve_posting_summary():
    actor, item = map(str, (uuid4(), uuid4()))
    posting = {"posted_at": "2026-10-25T12:00:00Z", "locality": "Paris"}
    donation = {
        "id": item,
        "donor_id": actor,
        "basis_analysis_id": None,
        "status": "ready",
        "revision": 4,
        "facts_revision": 2,
        "facts_origin": "human",
        "category": "clothes",
        "attributes": {"type": "coat"},
        "quantity": "1",
        "unit": "item",
        "created_at": "2026-10-25T12:00:00Z",
        "updated_at": "2026-10-25T12:00:00Z",
    }
    summary = {
        "active_offer_id": None,
        "inventory_state": "unreceived",
        "posting": posting,
    }

    def upstream(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": actor})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": actor}])
        if request.url.path == "/rest/v1/donations":
            return httpx.Response(
                200,
                json=[] if request.url.params.get("offset", "0") != "0" else [donation],
            )
        if request.url.path in ("/rest/v1/donation_analysis", "/rest/v1/expiry_info"):
            return httpx.Response(200, json=[])
        if request.url.path == "/rest/v1/rpc/dono_owner_summaries":
            return httpx.Response(200, json={item: summary})
        if request.url.path == "/rest/v1/rpc/dono_item_summary":
            return httpx.Response(200, json=summary)
        raise AssertionError(request.url)

    with TestClient(
        create_app(configuration(), httpx.MockTransport(upstream))
    ) as client:
        for url in ("/api/v1/donations", f"/api/v1/donations/{item}"):
            response = client.get(url, headers={"Authorization": "Bearer test"})
            assert response.status_code == 200
            data = response.json()["data"]
            row = data[0] if isinstance(data, list) else data
            assert row["posting"] == posting
            assert "posting" not in row["computed"]


@pytest.mark.parametrize("action", ["posting", "unposting"])
def test_owner_posting_routes_use_revision_and_municipality(action):
    actor, item = map(str, (uuid4(), uuid4()))
    calls = []

    def upstream(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": actor})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": actor}])
        if request.url.host == "data.geopf.fr":
            assert request.url.params["type"] == "municipality"
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
                            },
                        }
                    ]
                },
            )
        if request.url.path == "/rest/v1/donations":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": item,
                        "donor_id": actor,
                        "basis_analysis_id": None,
                        "status": "ready",
                        "revision": 4,
                        "facts_revision": 2,
                        "facts_origin": "human",
                        "category": "clothes",
                        "attributes": {"type": "coat"},
                        "quantity": "1",
                        "unit": "item",
                        "created_at": "2026-10-25T12:00:00Z",
                        "updated_at": "2026-10-25T12:00:00Z",
                    }
                ],
            )
        if request.url.path in ("/rest/v1/donation_analysis", "/rest/v1/expiry_info"):
            return httpx.Response(200, json=[])
        if request.url.path == "/rest/v1/rpc/dono_posting":
            body = json.loads(request.content)
            calls.append(body)
            assert body["action"] == action
            assert body["item"] == item and body["actor"] == actor
            assert body["body"]["expected_revision"] == "3"
            if action == "posting":
                assert body["body"]["locality"] == "Paris"
                assert body["body"]["latitude"] == 48.85
                assert body["body"]["longitude"] == 2.35
            return httpx.Response(200, json={"id": item, "replay": False})
        if request.url.path == "/rest/v1/rpc/dono_item_summary":
            return httpx.Response(
                200,
                json={
                    "active_offer_id": None,
                    "inventory_state": "unreceived",
                    "posting": None
                    if action == "unposting"
                    else {"locality": "Paris", "posted_at": "2026-10-25T12:00:00Z"},
                },
            )
        raise AssertionError(request.url)

    with TestClient(
        create_app(configuration(), httpx.MockTransport(upstream))
    ) as client:
        response = client.post(
            f"/api/v1/donations/{item}/{action}",
            headers={"Authorization": "Bearer test", "Idempotency-Key": str(uuid4())},
            json={
                "expected_revision": "3",
                **({"location": "Paris"} if action == "posting" else {}),
            },
        )
        assert response.status_code == 200
        assert len(calls) == 1
        assert response.json()["data"]["revision"] == "4"
        assert (response.json()["data"]["posting"] is None) == (action == "unposting")
