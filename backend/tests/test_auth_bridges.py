"""Managed Auth access stays behind narrow, private owner bridges."""

from collections.abc import Iterator
from uuid import uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_photo_upload_limit import create_item, photo_body
from test_workflow_database import setup


@pytest.fixture
def restricted_database(postgres: str) -> Iterator[psycopg.Connection]:
    with psycopg.connect(postgres) as connection:
        connection.execute("revoke usage on schema auth from dono_command_owner")
        assert not connection.execute(
            "select has_schema_privilege('dono_command_owner','auth','USAGE')"
        ).fetchone()[0]
        yield connection
        connection.rollback()


def test_bridge_ownership_and_acl(restricted_database: psycopg.Connection) -> None:
    connection = restricted_database
    for signature in ("private.current_user_id()", "private.auth_user_exists(uuid)"):
        row = connection.execute(
            "select r.rolname,p.prosecdef,p.provolatile,p.proconfig "
            "from pg_proc p join pg_roles r on r.oid=p.proowner "
            "where p.oid=%s::regprocedure",
            (signature,),
        ).fetchone()
        assert row == ("postgres", True, "s", ['search_path=""'])
        assert connection.execute(
            "select has_function_privilege('dono_command_owner',%s,'EXECUTE')",
            (signature,),
        ).fetchone()[0]
        for role in ("anon", "authenticated", "service_role"):
            assert not connection.execute(
                "select has_function_privilege(%s,%s,'EXECUTE')", (role, signature)
            ).fetchone()[0]
    # Application wrappers retain their restricted owner and service-only entrypoint.
    assert (
        connection.execute(
            "select proowner::regrole::text from pg_proc "
            "where oid='public.dono_profile(uuid,uuid,text,jsonb)'::regprocedure"
        ).fetchone()[0]
        == "dono_command_owner"
    )
    assert connection.execute(
        "select has_function_privilege('service_role',"
        "'public.dono_profile(uuid,uuid,text,jsonb)','EXECUTE')"
    ).fetchone()[0]
    assert not connection.execute(
        "select has_function_privilege('authenticated',"
        "'public.dono_profile(uuid,uuid,text,jsonb)','EXECUTE')"
    ).fetchone()[0]


def test_bridge_reads_only_verified_subject_and_identity_existence(
    restricted_database: psycopg.Connection,
) -> None:
    connection = restricted_database
    actor = uuid4()
    connection.execute("insert into auth.users values(%s)", (actor,))
    connection.execute(
        "select set_config('request.jwt.claim.sub',%s,true)", (str(actor),)
    )
    connection.execute("set local role dono_command_owner")
    assert connection.execute("select private.current_user_id()").fetchone()[0] == actor
    assert connection.execute(
        "select private.auth_user_exists(%s)", (actor,)
    ).fetchone()[0]
    assert not connection.execute(
        "select private.auth_user_exists(%s)", (uuid4(),)
    ).fetchone()[0]
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with connection.transaction():
            connection.execute("select id from auth.users limit 1")
    connection.execute("select set_config('request.jwt.claim.sub','',true)")
    assert connection.execute("select private.current_user_id()").fetchone()[0] is None


def test_bootstrap_without_auth_usage_preserves_identity_and_disabled_rules(
    restricted_database: psycopg.Connection,
) -> None:
    connection = restricted_database
    actor = uuid4()
    connection.execute("insert into auth.users values(%s)", (actor,))
    connection.execute("set local role service_role")
    result = connection.execute(
        "select public.dono_profile(%s,%s,'bootstrap','{}')", (actor, uuid4())
    ).fetchone()[0]
    assert result["platform_role"] == "donor"
    assert result["id"] == str(actor)
    unknown = uuid4()
    with pytest.raises(psycopg.errors.RaiseException, match="not_found"):
        with connection.transaction():
            connection.execute(
                "select public.dono_profile(%s,%s,'bootstrap','{}')", (unknown, uuid4())
            )
    connection.execute("reset role")
    assert not connection.execute(
        "select exists(select 1 from public.profiles where id=%s)", (unknown,)
    ).fetchone()[0]
    connection.execute(
        "update public.profiles set disabled_at=clock_timestamp() where id=%s", (actor,)
    )
    connection.execute("set local role service_role")
    with pytest.raises(psycopg.errors.RaiseException, match="account_disabled"):
        with connection.transaction():
            connection.execute(
                "select public.dono_profile(%s,%s,'bootstrap','{}')", (actor, uuid4())
            )


def test_rls_helpers_and_photo_scope_without_auth_usage(
    restricted_database: psycopg.Connection,
) -> None:
    connection = restricted_database
    data = setup(connection)
    outsider, other_item = create_item(connection)
    connection.execute("set local role authenticated")
    connection.execute(
        "select set_config('request.jwt.claim.sub',%s,true)", (str(data["donor"]),)
    )
    assert connection.execute("select private.enabled()").fetchone()[0]
    assert connection.execute("select private.owns(%s)", (data["item"],)).fetchone()[0]
    assert not connection.execute("select private.owns(%s)", (other_item,)).fetchone()[
        0
    ]
    assert not connection.execute("select private.platform()").fetchone()[0]
    assert not connection.execute(
        "select private.member_of(%s)", (data["association"],)
    ).fetchone()[0]
    connection.execute(
        "select set_config('request.jwt.claim.sub',%s,true)", (str(data["admin"]),)
    )
    assert connection.execute(
        "select private.member_of(%s,true)", (data["association"],)
    ).fetchone()[0]
    connection.execute("reset role")
    platform = connection.execute(
        "select approved_by from public.associations where id=%s",
        (data["association"],),
    ).fetchone()[0]
    connection.execute("set local role authenticated")
    connection.execute(
        "select set_config('request.jwt.claim.sub',%s,true)", (str(platform),)
    )
    assert connection.execute("select private.platform()").fetchone()[0]
    connection.execute("reset role")
    photo = connection.execute(
        "select public.dono_photo(%s,%s,%s,%s)",
        (outsider, uuid4(), other_item, Jsonb(photo_body(100))),
    ).fetchone()[0]["id"]
    connection.execute("set local role service_role")
    stored = connection.execute(
        "select public.dono_photo_content(%s,%s)", (outsider, photo)
    ).fetchone()[0]
    assert stored["photo"]["id"] == photo
    with pytest.raises(psycopg.errors.RaiseException, match="not_found"):
        with connection.transaction():
            connection.execute(
                "select public.dono_photo_content(%s,%s)", (data["donor"], photo)
            )
