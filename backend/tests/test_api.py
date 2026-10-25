from uuid import uuid4

import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_auth_validation_and_no_store() -> None:
    app = create_app(Settings(_env_file=None))
    with TestClient(app) as client:
        response = client.get("/api/v1/account/profile")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthenticated"
        assert response.headers["cache-control"] == "private, no-store"
        assert "request_id" in response.json()["error"]


def test_verified_identity_and_user_jwt_read_scope() -> None:
    actor = str(uuid4())

    def upstream(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer real-test-token"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(
                200, json={"id": actor, "user_metadata": {"role": "platform_admin"}}
            )
        return httpx.Response(
            200,
            json=[
                {
                    "id": actor,
                    "revision": 1,
                    "platform_role": "donor",
                    "display_name": None,
                    "created_at": "2026-10-25T00:00:00Z",
                    "updated_at": "2026-10-25T00:00:00Z",
                }
            ],
        )

    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="public-test-key",
    )
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get(
            "/api/v1/account/profile",
            headers={"Authorization": "Bearer real-test-token"},
        )
        assert response.status_code == 200
        assert response.json()["data"]["platform_role"] == "donor"
        assert response.json()["data"]["revision"] == "1"
        response = client.post(
            "/api/v1/donations",
            headers={
                "Authorization": "Bearer real-test-token",
                "Idempotency-Key": str(uuid4()),
            },
            json={"decision": "approved"},
        )
        assert response.status_code == 422
        assert "input" not in str(response.json())
