from datetime import UTC, timedelta
from io import BytesIO
from uuid import uuid4

import httpx
import psycopg
from fastapi.testclient import TestClient
from http_database import DatabaseHTTP
from PIL import Image

from app.config import Settings
from app.main import create_app


def test_http_donation_review_booking_receipt_stock(postgres: str) -> None:
    donor, admin, operator = uuid4(), uuid4(), uuid4()
    with psycopg.connect(postgres) as connection:
        for actor in (donor, admin, operator):
            connection.execute("insert into auth.users values(%s)", (actor,))
    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="public-test-key",
        supabase_secret_key="secret-test-key",
        openai_api_key="test-only",
        openai_model="configured-model",
        qr_signing_key="test-qr-secret-with-more-than-32-chars",
    )

    def headers(actor, key=None):
        return {
            "Authorization": f"Bearer test:{actor}",
            "Idempotency-Key": str(key or uuid4()),
        }

    def checked(response, status=200):
        assert response.status_code == status, response.text
        return response.json()["data"]

    with TestClient(
        create_app(config, httpx.MockTransport(DatabaseHTTP(postgres)))
    ) as client:
        for actor in (donor, admin, operator):
            checked(
                client.post("/api/v1/account/profile", headers=headers(actor), json={}),
                201,
            )
        with psycopg.connect(postgres) as connection:
            connection.execute(
                "update public.profiles set platform_role='platform_admin' where id=%s",
                (operator,),
            )
        association = checked(
            client.post(
                "/api/v1/associations",
                headers=headers(admin),
                json={"name": "HTTP test", "rna": "W" + str(uuid4().int)[:9]},
            ),
            201,
        )["id"]
        checked(
            client.post(
                f"/api/v1/admin/associations/{association}/approval",
                headers=headers(operator),
                json={"expected_revision": "1"},
            )
        )
        checked(
            client.patch(
                f"/api/v1/associations/{association}",
                headers=headers(admin),
                json={
                    "expected_revision": "2",
                    "address": "Test site",
                    "opening_hours": [
                        {"weekday": day, "start_local": "00:00", "end_local": "23:59"}
                        for day in range(1, 8)
                    ],
                },
            )
        )
        with psycopg.connect(postgres) as connection:
            now = (
                connection.execute("select clock_timestamp()")
                .fetchone()[0]
                .astimezone(UTC)
            )
        need = checked(
            client.post(
                f"/api/v1/associations/{association}/needs",
                headers=headers(admin),
                json={
                    "category": "clothes",
                    "attributes": {},
                    "seasons": [],
                    "target_quantity": "10",
                    "unit": "item",
                    "storage_units_per_item": 2,
                    "active": True,
                },
            ),
            201,
        )["id"]
        checked(
            client.put(
                f"/api/v1/associations/{association}/capacity/clothes",
                headers=headers(admin),
                json={"storage_unit": "item_slot", "limit_storage_units": 6},
            )
        )
        from zoneinfo import ZoneInfo

        day = (
            (now + timedelta(minutes=1))
            .astimezone(ZoneInfo("Europe/Paris"))
            .date()
            .isoformat()
        )
        checked(
            client.put(
                f"/api/v1/associations/{association}/intake-quotas/clothes/{day}",
                headers=headers(admin),
                json={"unit": "item", "limit_quantity": "2"},
            )
        )
        slot = checked(
            client.post(
                f"/api/v1/associations/{association}/slots",
                headers=headers(admin),
                json={
                    "starts_at": (now + timedelta(minutes=1)).isoformat(),
                    "ends_at": (now + timedelta(minutes=31)).isoformat(),
                    "max_bookings": 1,
                },
            ),
            201,
        )["id"]
        donation = checked(
            client.post(
                "/api/v1/donations",
                headers=headers(donor),
                json={
                    "facts": {
                        "name": "Winter coat",
                        "category": "clothes",
                        "attributes": {"type": "coat"},
                        "quantity": "1",
                        "unit": "item",
                    }
                },
            ),
            201,
        )
        image = BytesIO()
        Image.new("RGB", (4, 4)).save(image, format="PNG")
        photo = checked(
            client.post(
                f"/api/v1/donations/{donation['id']}/photos",
                headers=headers(donor),
                files={"file": ("coat.png", image.getvalue(), "image/png")},
                data={"kind": "item"},
            ),
            201,
        )
        assert (
            client.get(photo["content_url"], headers=headers(donor)).content
            == image.getvalue()
        )
        analysis = checked(
            client.post(
                f"/api/v1/donations/{donation['id']}/analyses",
                headers=headers(donor),
                json={"photo_ids": [photo["id"]]},
            ),
            201,
        )
        assert analysis["basis_attached"] and not analysis["facts_seeded"]
        checked(
            client.post(
                f"/api/v1/donations/{donation['id']}/publication",
                headers=headers(donor),
                json={"expected_revision": "2"},
            )
        )
        response = client.post(
            f"/api/v1/donations/{donation['id']}/matches",
            headers=headers(donor),
            json={"origin": {"latitude": 48.85, "longitude": 2.35}},
        )
        assert response.status_code == 200, response.text
        assert any(match["need_id"] == need for match in response.json()["data"])
        for path, actor in [
            ("/api/v1/account/profile", donor),
            ("/api/v1/account/memberships", admin),
            ("/api/v1/admin/associations", operator),
            (f"/api/v1/associations/{association}", admin),
            (f"/api/v1/associations/{association}/members", admin),
            (f"/api/v1/associations/{association}/membership-events", admin),
            (f"/api/v1/associations/{association}/needs", admin),
            (f"/api/v1/associations/{association}/capacity", admin),
            (
                f"/api/v1/associations/{association}/intake-quotas?from={day}&to={day}",
                admin,
            ),
            (
                f"/api/v1/associations/{association}/slots?from={now.isoformat()}&to={(now+timedelta(days=1)).isoformat()}",
                admin,
            ),
            (f"/api/v1/donations/{donation['id']}", donor),
            (f"/api/v1/donations/{donation['id']}/photos", donor),
            (f"/api/v1/donations/{donation['id']}/analyses", donor),
            (f"/api/v1/donations/{donation['id']}/edits", donor),
            ("/api/v1/redirect-points", donor),
        ]:
            response = client.get(path.replace("+", "%2B"), headers=headers(actor))
            assert response.status_code == 200, (path, response.text)
        checked(
            client.post(
                f"/api/v1/associations/{association}/needs/parse",
                headers=headers(admin),
                json={"text": "10 coats, any season"},
            )
        )
        extra = checked(
            client.post("/api/v1/donations", headers=headers(donor), json={}), 201
        )
        assert extra["facts"]["category"] is None
        first = client.get("/api/v1/donations?limit=1", headers=headers(donor))
        assert first.status_code == 200, first.text
        cursor = first.json()["page"]["next_cursor"]
        assert cursor is not None
        assert (
            client.get(
                "/api/v1/donations",
                headers=headers(donor),
                params={"limit": 1, "cursor": cursor},
            ).status_code
            == 200
        )
        offer = checked(
            client.post(
                f"/api/v1/donations/{donation['id']}/offers",
                headers=headers(donor),
                json={
                    "expected_donation_revision": "3",
                    "association_id": association,
                    "need_id": need,
                },
            ),
            201,
        )
        for path, actor in [
            (f"/api/v1/donations/{donation['id']}/offers", donor),
            (f"/api/v1/associations/{association}/offers", admin),
            (f"/api/v1/offers/{offer['id']}", admin),
            (f"/api/v1/offers/{offer['id']}/events", admin),
            (f"/api/v1/offers/{offer['id']}/evidence", admin),
        ]:
            response = client.get(path, headers=headers(actor))
            assert response.status_code == 200, response.text
        assert (
            client.get(
                f"/api/v1/offers/{offer['id']}/booking", headers=headers(donor)
            ).status_code
            == 404
        )
        approved = checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/decision",
                headers=headers(admin),
                json={
                    "expected_revision": "1",
                    "decision": "approved",
                    "intake_checks": {
                        "not_medicine": True,
                        "analysis_unavailable_ack": True,
                    },
                    "reason": "Manually checked item",
                },
            )
        )
        assert approved["decision"] == "approved"
        response = client.get(
            f"/api/v1/offers/{offer['id']}/slots", headers=headers(donor)
        )
        assert response.status_code == 200, response.text
        booking = checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/bookings",
                headers=headers(donor),
                json={"expected_offer_revision": "2", "slot_id": slot},
            ),
            201,
        )
        for actor in (donor, admin):
            restored = checked(
                client.get(
                    f"/api/v1/offers/{offer['id']}/booking", headers=headers(actor)
                )
            )
            assert restored == booking
            assert "qr_nonce" not in restored
        assert (
            client.get(
                f"/api/v1/offers/{offer['id']}/booking", headers=headers(operator)
            ).status_code
            == 404
        )
        response = client.get(
            f"/api/v1/associations/{association}/arrivals?date={day}",
            headers=headers(admin),
        )
        assert response.status_code == 200, response.text
        qr = checked(
            client.get(f"/api/v1/bookings/{booking['id']}/qr", headers=headers(donor))
        )
        with psycopg.connect(postgres) as connection:
            connection.execute(
                (
                    "update public.slots set "
                    "starts_at=clock_timestamp()-interval '1 minute' where id=%s"
                ),
                (slot,),
            )
        checked(
            client.post(
                f"/api/v1/associations/{association}/qr/resolve",
                headers=headers(admin),
                json={"payload": qr["payload"]},
            )
        )
        receipt_key = uuid4()
        body = {
            "expected_revision": "1",
            "payload": qr["payload"],
            "confirm_full_received": True,
        }
        received = checked(
            client.post(
                f"/api/v1/bookings/{booking['id']}/reception",
                headers=headers(admin, receipt_key),
                json=body,
            )
        )
        replay = checked(
            client.post(
                f"/api/v1/bookings/{booking['id']}/reception",
                headers=headers(admin, receipt_key),
                json=body,
            )
        )
        assert replay["receipt"]["id"] == received["receipt"]["id"]
        checked(
            client.get(
                f"/api/v1/associations/{association}/expiry-counts",
                headers=headers(admin),
            )
        )
        result = client.get(
            f"/api/v1/associations/{association}/expiry?view=distribute_first",
            headers=headers(admin),
        )
        assert result.status_code == 200, result.text
        assert result.json()["data"][0]["expiry"]["bucket"] == "not_applicable"
        for path in (
            f"/api/v1/associations/{association}/inventory",
            f"/api/v1/associations/{association}/images",
        ):
            response = client.get(path, headers=headers(admin))
            assert response.status_code == 200, response.text
        checked(
            client.post(
                f"/api/v1/inventory/{received['receipt']['id']}/distributions",
                headers=headers(admin),
                json={"confirm_full_distribution": True},
            ),
            201,
        )
