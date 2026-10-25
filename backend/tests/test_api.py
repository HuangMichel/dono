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


def test_health_is_available_without_credentials_or_dependencies() -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        raise AssertionError("Liveness must not call external services")

    config = Settings(_env_file=None)
    with TestClient(create_app(config, httpx.MockTransport(upstream))) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "private, no-store"


def test_cors_allows_configured_frontend_headers_and_denies_other_origins() -> None:
    config = Settings(_env_file=None, app_origin="https://dono.example")
    with TestClient(create_app(config)) as client:
        headers = {
            "Origin": "https://dono.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": (
                "authorization,content-type,idempotency-key"
            ),
        }
        allowed = client.options("/api/v1/donations", headers=headers)
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "https://dono.example"
        assert "access-control-allow-credentials" not in allowed.headers

        denied = client.options(
            "/api/v1/donations", headers=headers | {"Origin": "https://other.example"}
        )
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers

        unauthenticated = client.get(
            "/api/v1/account/profile", headers={"Origin": "https://dono.example"}
        )
        assert unauthenticated.status_code == 401
        assert unauthenticated.headers["access-control-allow-origin"] == (
            "https://dono.example"
        )
