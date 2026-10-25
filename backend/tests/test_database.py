from uuid import uuid4

import psycopg
from psycopg.types.json import Jsonb


def test_schema_and_rls(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        count = connection.execute(
            "select count(*) from pg_tables where schemaname in ('public','private')"
        ).fetchone()
        assert count == (21,)
        assert connection.execute(
            "select count(*) from pg_tables where schemaname in "
            "('public','private') and not rowsecurity"
        ).fetchone() == (0,)
        assert connection.execute(
            "select "
            "has_table_privilege('authenticated','private.photo_contents','select')"
        ).fetchone() == (False,)


def test_bootstrap_and_owner_isolation(postgres: str) -> None:
    owner, foreign = uuid4(), uuid4()
    with psycopg.connect(postgres) as connection:
        for actor in (owner, foreign):
            connection.execute("insert into auth.users values(%s)", (actor,))
            connection.execute(
                "select public.dono_profile(%s,%s,%s,%s)",
                (actor, uuid4(), "bootstrap", Jsonb({})),
            )
        result = connection.execute(
            "select public.dono_item(%s,%s,%s,%s,%s)",
            (owner, uuid4(), "create", None, Jsonb({})),
        ).fetchone()[0]
        connection.execute("set local role authenticated")
        connection.execute(
            "select set_config('request.jwt.claim.sub',%s,true)", (str(foreign),)
        )
        assert (
            connection.execute(
                "select * from public.donations where id=%s", (result["id"],)
            ).fetchall()
            == []
        )
        connection.execute(
            "select set_config('request.jwt.claim.sub',%s,true)", (str(owner),)
        )
        assert (
            len(
                connection.execute(
                    "select * from public.donations where id=%s", (result["id"],)
                ).fetchall()
            )
            == 1
        )
        connection.rollback()
