"""Upload boundaries through HTTP and PostgreSQL, without live providers."""

import base64
import json
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient
from http_database import DatabaseHTTP
from PIL import Image
from psycopg.types.json import Jsonb

from app.config import Settings
from app.main import create_app


def image_bytes(size: int) -> bytes:
    image = BytesIO()
    Image.new("RGB", (2, 2)).save(image, format="PNG")
    content = image.getvalue()
    return content + b"\0" * (size - len(content))


def create_item(connection: psycopg.Connection) -> tuple:
    actor = uuid4()
    connection.execute("insert into auth.users values(%s)", (actor,))
    connection.execute(
        "select public.dono_profile(%s,%s,'bootstrap','{}')", (actor, uuid4())
    )
    item = connection.execute(
        "select public.dono_item(%s,%s,'create',null,'{}')", (actor, uuid4())
    ).fetchone()[0]["id"]
    return actor, item


def photo_body(size: int) -> dict:
    content = image_bytes(size)
    return {
        "kind": "item",
        "mime_type": "image/png",
        "size_bytes": size,
        "sha256": sha256(content).hexdigest(),
        "image_base64": base64.b64encode(content).decode(),
    }


@pytest.mark.parametrize("size,status", [(4_194_304, 201), (4_194_305, 413)])
def test_api_photo_boundary(size: int, status: int) -> None:
    actor, item, photo = uuid4(), uuid4(), uuid4()
    writes = []

    def upstream(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": str(actor)})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": str(actor)}])
        if request.url.path == "/rest/v1/rpc/dono_photo":
            writes.append(json.loads(request.content))
            return httpx.Response(200, json={"id": str(photo), "replay": False})
        assert request.url.path == "/rest/v1/donation_photos"
        return httpx.Response(
            200,
            json=[
                {
                    "id": str(photo),
                    "donation_id": str(item),
                    "mime_type": "image/png",
                    "size_bytes": size,
                    "sha256": sha256(image_bytes(size)).hexdigest(),
                    "kind": "item",
                    "created_at": "2026-10-25T00:00:00Z",
                }
            ],
        )

    settings = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="test-public",
        supabase_secret_key="test-secret",
    )
    with TestClient(create_app(settings, httpx.MockTransport(upstream))) as client:
        response = client.post(
            f"/api/v1/donations/{item}/photos",
            headers={"Authorization": "Bearer test", "Idempotency-Key": str(uuid4())},
            data={"kind": "item"},
            files={"file": ("photo.png", image_bytes(size), "image/png")},
        )
    assert response.status_code == status, response.text
    assert len(writes) == (1 if status == 201 else 0)
    if writes:
        assert writes[0]["body"]["size_bytes"] == 4_194_304


@pytest.mark.parametrize("size,status", [(4_194_304, 201), (4_194_305, 413)])
def test_http_photo_limit(postgres: str, size: int, status: int) -> None:
    with psycopg.connect(postgres) as connection:
        actor, item = create_item(connection)
    settings = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="test-public",
        supabase_secret_key="test-secret",
    )
    with TestClient(
        create_app(settings, httpx.MockTransport(DatabaseHTTP(postgres)))
    ) as client:
        response = client.post(
            f"/api/v1/donations/{item}/photos",
            headers={
                "Authorization": f"Bearer test:{actor}",
                "Idempotency-Key": str(uuid4()),
            },
            data={"kind": "item"},
            files={"file": ("photo.png", image_bytes(size), "image/png")},
        )
    assert response.status_code == status, response.text
    with psycopg.connect(postgres) as connection:
        assert connection.execute(
            "select count(*) from public.donation_photos where donation_id=%s",
            (item,),
        ).fetchone()[0] == (1 if status == 201 else 0)
        assert connection.execute(
            "select revision from public.donations where id=%s", (item,)
        ).fetchone()[0] == (2 if status == 201 else 1)
        if status == 413:
            assert response.json()["error"]["code"] == "upload_too_large"
            assert (
                connection.execute(
                    "select count(*) from private.api_requests "
                    "where actor_id=%s and operation like 'photo/%%'",
                    (actor,),
                ).fetchone()[0]
                == 0
            )


@pytest.mark.parametrize("size", [4_194_304, 4_194_305])
def test_database_photo_limit(postgres: str, size: int) -> None:
    with psycopg.connect(postgres) as connection:
        actor, item = create_item(connection)
        if size == 4_194_304:
            connection.execute(
                "select public.dono_photo(%s,%s,%s,%s)",
                (actor, uuid4(), item, Jsonb(photo_body(size))),
            )
        else:
            with pytest.raises(psycopg.errors.RaiseException, match="upload_too_large"):
                with connection.transaction():
                    connection.execute(
                        "select public.dono_photo(%s,%s,%s,%s)",
                        (actor, uuid4(), item, Jsonb(photo_body(size))),
                    )
            assert (
                connection.execute(
                    "select count(*) from public.donation_photos where donation_id=%s",
                    (item,),
                ).fetchone()[0]
                == 0
            )
            assert (
                connection.execute(
                    "select revision from public.donations where id=%s", (item,)
                ).fetchone()[0]
                == 1
            )
            assert (
                connection.execute(
                    "select count(*) from private.api_requests "
                    "where actor_id=%s and operation like 'photo/%%'",
                    (actor,),
                ).fetchone()[0]
                == 0
            )


def test_upload_migration_preserves_legacy_photo(postgres: str) -> None:
    supabase = Path(__file__).parents[2] / "supabase"
    original = (
        (supabase / "migrations/20261025000250_dono_photos_analysis.sql")
        .read_text()
        .split("create function public.dono_photo_content", 1)[0]
    )
    original = original.replace("create function", "create or replace function", 1)
    change = (supabase / "changes/vercel/photo_upload_limit_4mib.sql").read_text()
    legacy = photo_body(4_194_305)

    with psycopg.connect(postgres) as connection:
        actor, item = create_item(connection)
        connection.execute(
            "alter table public.donation_photos "
            "drop constraint donation_photos_upload_limit_4mib"
        )
        connection.execute(original)
        photo = connection.execute(
            "select public.dono_photo(%s,%s,%s,%s)",
            (actor, uuid4(), item, Jsonb(legacy)),
        ).fetchone()[0]["id"]

        connection.execute(change)

        stored = connection.execute(
            "select public.dono_photo_content(%s,%s)", (actor, photo)
        ).fetchone()[0]
        assert stored["photo"]["size_bytes"] == 4_194_305
        assert stored["photo"]["sha256"] == legacy["sha256"]
        assert stored["image_base64"] == legacy["image_base64"]
        assert (
            connection.execute(
                "select convalidated from pg_constraint "
                "where conrelid='public.donation_photos'::regclass "
                "and conname='donation_photos_upload_limit_4mib'"
            ).fetchone()[0]
            is False
        )
        # Even an internal metadata insert cannot bypass the new upload bound.
        with pytest.raises(psycopg.errors.CheckViolation):
            with connection.transaction():
                connection.execute(
                    "insert into public.donation_photos"
                    "(donation_id,mime_type,size_bytes,sha256,kind,uploaded_by) "
                    "values(%s,'image/png',4194305,%s,'item',%s)",
                    (item, legacy["sha256"], actor),
                )
        connection.rollback()
