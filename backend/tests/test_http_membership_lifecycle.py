"""Account revocation, last-admin recovery and donor cancellation through HTTP."""

from uuid import uuid4

import httpx
import psycopg
from fastapi.testclient import TestClient
from http_database import DatabaseHTTP
from test_workflow_database import setup

from app.config import Settings
from app.main import create_app


def headers(actor, key=None):
    return {
        "Authorization": f"Bearer test:{actor}",
        "Idempotency-Key": str(key or uuid4()),
    }


def client_for(uri):
    return TestClient(
        create_app(
            Settings(
                _env_file=None,
                supabase_url="https://supabase.test",
                supabase_publishable_key="public-test-key",
                supabase_secret_key="secret-test-key",
                openai_api_key="test-only",
                openai_model="test-model",
                qr_signing_key="test-qr-signing-key-at-least-32-bytes",
            ),
            httpx.MockTransport(DatabaseHTTP(uri)),
        )
    )


def checked(response, status=200):
    assert response.status_code == status, response.text
    return response.json()["data"] if status < 400 else response.json()["error"]


def test_membership_revocation_transfer_last_admin_and_recovery(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        target, platform = uuid4(), uuid4()
        connection.execute("insert into auth.users values(%s),(%s)", (target, platform))
    base = f"/api/v1/associations/{data['association']}"
    with client_for(postgres) as client:
        for actor in (target, platform):
            checked(
                client.post("/api/v1/account/profile", headers=headers(actor), json={}),
                201,
            )
        with psycopg.connect(postgres) as connection:
            connection.execute(
                (
                    "update public.profiles set platform_role='platform_admin' "
                    "where id=%s"
                ),
                (platform,),
            )
        profile = checked(
            client.patch(
                "/api/v1/account/profile",
                headers=headers(target),
                json={"expected_revision": "1", "display_name": "Test staff"},
            )
        )
        assert profile["revision"] == "2"
        granted = checked(
            client.post(
                base + "/members",
                headers=headers(data["admin"]),
                json={"profile_id": str(target), "role": "assoc_staff"},
            ),
            201,
        )
        assert granted["role"] == "assoc_staff"
        checked(
            client.patch(
                base + f"/members/{data['admin']}",
                headers=headers(data["admin"]),
                json={
                    "expected_revision": "2",
                    "active": False,
                    "reason": "Last admin attempt",
                },
            ),
            409,
        )
        checked(
            client.patch(
                base + f"/members/{target}",
                headers=headers(data["admin"]),
                json={"expected_revision": "1", "active": False, "reason": "Revoked"},
            )
        )
        checked(client.get(base + "/offers", headers=headers(target)), 403)
        checked(
            client.patch(
                base + f"/members/{target}",
                headers=headers(data["admin"]),
                json={"expected_revision": "2", "active": True},
            )
        )
        transferred = checked(
            client.post(
                base + "/admin-transfer",
                headers=headers(data["admin"]),
                json={"expected_revision": "2", "target_profile_id": str(target)},
            )
        )
        assert transferred["initiator"]["role"] == "assoc_staff"
        assert transferred["target"]["role"] == "assoc_admin"
        assert len(transferred["event_ids"]) == 2
        checked(client.get(base + "/members", headers=headers(data["admin"])), 403)
        recovery = f"/api/v1/admin/associations/{data['association']}/admin-recovery"
        checked(
            client.post(
                recovery,
                headers=headers(platform),
                json={"expected_revision": "2", "reason": "No orphan yet"},
            ),
            409,
        )
        with psycopg.connect(postgres) as connection:
            connection.execute(
                (
                    "update public.profiles set disabled_at=clock_timestamp() "
                    "where id=%s"
                ),
                (target,),
            )
        recovered = checked(
            client.post(
                recovery,
                headers=headers(platform),
                json={
                    "expected_revision": "2",
                    "reason": "Verified original applicant",
                },
            )
        )
        assert recovered["membership"]["profile_id"] == str(data["admin"])
        assert recovered["membership"]["role"] == "assoc_admin"
        checked(client.get("/api/v1/account/profile", headers=headers(target)), 403)
        pending = checked(
            client.post(
                "/api/v1/associations",
                headers=headers(data["donor"]),
                json={"name": "Pending", "rna": "W" + str(uuid4().int)[:9]},
            ),
            201,
        )
        pending_base = f"/api/v1/associations/{pending['id']}"
        checked(
            client.get(pending_base + "/needs", headers=headers(data["donor"])), 403
        )
        changed = checked(
            client.patch(
                pending_base,
                headers=headers(data["donor"]),
                json={"expected_revision": "1", "name": "Corrected pending"},
            )
        )
        assert changed["revision"] == "2"
        checked(
            client.post(
                f"/api/v1/admin/associations/{pending['id']}/approval",
                headers=headers(data["donor"]),
                json={"expected_revision": "2"},
            ),
            403,
        )
        approved = checked(
            client.post(
                f"/api/v1/admin/associations/{pending['id']}/approval",
                headers=headers(platform),
                json={"expected_revision": "2"},
            )
        )
        assert approved["membership"]["active"]


def test_withdraw_restore_refuse_cancel_and_idle_expiry(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
    item = f"/api/v1/donations/{data['item']}"
    association = f"/api/v1/associations/{data['association']}"
    submit = {
        "association_id": data["association"],
        "need_id": str(data["need"]),
        "expected_donation_revision": "3",
    }
    approve = {
        "expected_revision": "1",
        "decision": "approved",
        "intake_checks": {"not_medicine": True, "analysis_unavailable_ack": True},
        "reason": "Manual review",
    }
    with client_for(postgres) as client:
        offer = checked(
            client.post(item + "/offers", headers=headers(data["donor"]), json=submit),
            201,
        )
        checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/withdrawal",
                headers=headers(data["donor"]),
                json={"expected_revision": "1"},
            )
        )
        offer = checked(
            client.post(item + "/offers", headers=headers(data["donor"]), json=submit),
            201,
        )
        checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/decision",
                headers=headers(data["admin"]),
                json=approve,
            )
        )
        booking = checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/bookings",
                headers=headers(data["donor"]),
                json={"expected_offer_revision": "2", "slot_id": str(data["slot"])},
            ),
            201,
        )
        cancelled = checked(
            client.post(
                f"/api/v1/bookings/{booking['id']}/cancellation",
                headers=headers(data["donor"]),
                json={"expected_revision": "1", "reason": "Cannot attend"},
            )
        )
        assert (
            cancelled["offer"]["status"] == "cancelled"
            and cancelled["offer"]["decision"] == "approved"
        )
        checked(
            client.post(
                item + "/withdrawal",
                headers=headers(data["donor"]),
                json={"expected_revision": "3"},
            )
        )
        restored = checked(
            client.post(
                item + "/restoration",
                headers=headers(data["donor"]),
                json={"expected_revision": "4"},
            )
        )
        assert restored["status"] == "ready"
        facts = restored["facts"]
        facts["attributes"]["size"] = "L"
        changed = checked(
            client.patch(
                item,
                headers=headers(data["donor"]),
                json={"expected_revision": "5", "facts": facts},
            )
        )
        submit["expected_donation_revision"] = changed["revision"]
        offer = checked(
            client.post(item + "/offers", headers=headers(data["donor"]), json=submit),
            201,
        )
        checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/decision",
                headers=headers(data["admin"]),
                json={
                    "expected_revision": "1",
                    "decision": "refused",
                    "reason": "Condition reviewed",
                },
            )
        )
        offer = checked(
            client.post(item + "/offers", headers=headers(data["donor"]), json=submit),
            201,
        )
        checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/decision",
                headers=headers(data["admin"]),
                json=approve,
            )
        )
        checked(
            client.post(
                f"/api/v1/offers/{offer['id']}/cancellation",
                headers=headers(data["admin"]),
                json={"expected_revision": "2", "reason": "Intake unavailable"},
            )
        )
        offer = checked(
            client.post(item + "/offers", headers=headers(data["donor"]), json=submit),
            201,
        )
        with psycopg.connect(postgres) as connection:
            connection.execute(
                (
                    "update public.donation_offers set "
                    "created_at=clock_timestamp()-interval '4 days',"
                    "review_deadline=clock_timestamp()-interval '1 hour' where "
                    "id=%s"
                ),
                (offer["id"],),
            )
        read = checked(client.get(item, headers=headers(data["donor"])))
        assert read["computed"]["active_offer_id"] is None
        key = uuid4()
        reconciled = checked(
            client.post(
                association + "/expiration-reconciliation",
                headers=headers(data["admin"], key),
                json={},
            )
        )
        assert reconciled["offer_ids"] == [offer["id"]]
        replay = checked(
            client.post(
                association + "/expiration-reconciliation",
                headers=headers(data["admin"], key),
                json={},
            )
        )
        assert replay == reconciled
        empty = checked(
            client.post(
                association + "/expiration-reconciliation",
                headers=headers(data["admin"]),
                json={},
            )
        )
        assert empty["offer_ids"] == []
        replacement = checked(
            client.post(item + "/offers", headers=headers(data["donor"]), json=submit),
            201,
        )
        assert replacement["id"] != offer["id"]
