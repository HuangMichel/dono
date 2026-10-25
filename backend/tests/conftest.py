"""Real isolated PostgreSQL; auth stubs reproduce managed Supabase identity roles."""

from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest


@pytest.fixture(scope="session")
def postgres(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    import os

    runtime = tmp_path_factory.mktemp("pg-runtime")
    runtime.chmod(0o700)
    os.environ["XDG_RUNTIME_DIR"] = str(runtime)
    import pgserver

    server = pgserver.get_server(
        tmp_path_factory.mktemp("postgres"), cleanup_mode="delete"
    )
    uri = server.get_uri()
    with psycopg.connect(uri, autocommit=True) as connection:
        connection.execute(
            "create role anon; create role authenticated; create role "
            "service_role bypassrls; create schema auth; create table "
            "auth.users(id uuid primary key);"
        )
        connection.execute(
            "create function auth.uid() returns uuid language sql stable as $$ "
            "select "
            "nullif(current_setting('request.jwt.claim.sub',true),'')::uuid "
            "$$;"
        )
        connection.execute(
            "grant usage on schema auth to authenticated; grant execute on "
            "function auth.uid() to authenticated;"
        )
        supabase = Path(__file__).parents[2] / "supabase"
        migrations = sorted((supabase / "migrations").glob("*.sql"))
        for migration in migrations:
            connection.execute(migration.read_text())
        if not any(path.stem.endswith("_public_needs") for path in migrations):
            connection.execute((supabase / "changes/public_needs.sql").read_text())
        if not any(path.stem.endswith("_public_needs_location") for path in migrations):
            connection.execute(
                (supabase / "changes/public_needs_location.sql").read_text()
            )
    yield uri
    server.cleanup()
