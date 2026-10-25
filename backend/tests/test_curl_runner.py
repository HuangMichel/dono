"""Exercise the shipped curl scripts on HTTP and disposable PostgreSQL."""

import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest
import uvicorn
from http_database import DatabaseHTTP
from PIL import Image
from psycopg.types.json import Jsonb

from app.config import Settings
from app.main import create_app


def test_curl_scenario(postgres: str, tmp_path: Path) -> None:
    if not shutil.which("curl") or not shutil.which("jq"):
        pytest.skip("curl and jq required")
    names = (
        "DONOR_TOKEN",
        "OTHER_DONOR_TOKEN",
        "ADMIN_TOKEN",
        "STAFF_TOKEN",
        "OTHER_ADMIN_TOKEN",
        "PLATFORM_TOKEN",
    )
    actors = {name: uuid4() for name in names}
    with psycopg.connect(postgres) as connection:
        for actor in actors.values():
            connection.execute("insert into auth.users values(%s)", (actor,))
            connection.execute(
                "select public.dono_profile(%s,%s,%s,%s)",
                (actor, uuid4(), "bootstrap", Jsonb({})),
            )
        connection.execute(
            "update public.profiles set platform_role='platform_admin' where id=%s",
            (actors["PLATFORM_TOKEN"],),
        )
    photo = tmp_path / "test.png"
    Image.new("RGB", (4, 4)).save(photo, format="PNG")
    config = Settings(
        _env_file=None,
        supabase_url="https://supabase.test",
        supabase_publishable_key="public-test-key",
        supabase_secret_key="secret-test-key",
        openai_api_key="test-only",
        openai_model="test-model",
        qr_signing_key="test-only-signing-key-with-at-least-32-characters",
    )
    app = create_app(config, httpx.MockTransport(DatabaseHTTP(postgres)))
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        port = listener.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        thread = threading.Thread(
            target=server.run, kwargs={"sockets": [listener]}, daemon=True
        )
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started:
                assert thread.is_alive() and time.monotonic() < deadline
                time.sleep(0.05)
            env = os.environ.copy()
            env.update({name: "test:" + str(actor) for name, actor in actors.items()})
            env.update(
                BASE_URL=f"http://127.0.0.1:{port}/api/v1",
                TEST_TARGET="development",
                PHOTO=str(photo),
                RUN_OPENAI="1",
                TEST_SLOT_DELAY_SECONDS="20",
            )
            for script, message in (
                ("test-api.sh", "API run complete:"),
                ("test-api-expiry.sh", "17 API date cases passed"),
            ):
                run = subprocess.run(
                    ["bash", str(Path(__file__).parents[1] / "scripts" / script)],
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=110,
                )
                assert run.returncode == 0, run.stdout + run.stderr
                assert message in run.stdout
                print(run.stdout.splitlines()[-1])
        finally:
            server.should_exit = True
            thread.join(timeout=10)
