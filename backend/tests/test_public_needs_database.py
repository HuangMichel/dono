"""Public discovery filtering and execution grants against isolated PostgreSQL."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import psycopg
import pytest
from test_workflow_database import setup, workflow

from app.domain.matching import season


@pytest.mark.parametrize("had_create", [False, True])
@pytest.mark.parametrize("locality", [False, True])
def test_public_projection_can_be_redeployed_without_superuser(
    postgres: str, had_create: bool, locality: bool
) -> None:
    filename = "public_needs_location.sql" if locality else "public_needs.sql"
    payload = (Path(__file__).parents[2] / "supabase/changes" / filename).read_text()
    signature = (
        "public.dono_public_needs_in_location(public.donation_category,"
        "double precision,double precision,integer,integer,text,text)"
        if locality
        else "public.dono_public_needs(public.donation_category,"
        "double precision,double precision,integer,integer)"
    )
    with psycopg.connect(postgres) as connection:
        connection.execute("create role public_needs_deployer nologin nosuperuser")
        connection.execute("grant dono_command_owner to public_needs_deployer")
        connection.execute(
            "grant usage,create on schema public to public_needs_deployer "
            "with grant option"
        )
        if had_create:
            connection.execute("grant create on schema public to dono_command_owner")
        connection.execute("set local role public_needs_deployer")
        connection.execute(payload)
        connection.execute(payload)
        assert connection.execute(
            "select has_schema_privilege('dono_command_owner','public','CREATE')"
        ).fetchone() == (had_create,)
        assert connection.execute(
            "select pg_get_userbyid(proowner), prosecdef, "
            "has_function_privilege('service_role',oid,'EXECUTE'), "
            "has_function_privilege('anon',oid,'EXECUTE'), "
            "has_function_privilege('authenticated',oid,'EXECUTE') "
            "from pg_proc where oid=%s::regprocedure",
            (signature,),
        ).fetchone() == ("dono_command_owner", True, True, False, False)
        connection.rollback()


def query(connection, **kwargs):
    return connection.execute(
        "select public.dono_public_needs(%s,%s,%s,%s,%s)",
        (
            kwargs.get("category"),
            kwargs.get("latitude"),
            kwargs.get("longitude"),
            kwargs.get("limit", 10),
            kwargs.get("offset", 0),
        ),
    ).fetchone()[0]


def test_public_catalog_filters_ordering_balances_and_grants(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        need = str(data["need"])
        association = data["association"]
        connection.execute(
            "update public.associations set name='A public' where id=%s", (association,)
        )
        connection.execute(
            "update public.needs set source_text='private note' where id=%s", (need,)
        )
        connection.execute("set local role service_role")
        result = query(connection)
        row = next(row for row in result["data"] if row["id"] == need)
        assert row == {
            "id": need,
            "association": {
                "id": str(association),
                "name": "A public",
                "display_address": "Test address",
            },
            "category": "clothes",
            "attributes": {},
            "seasons": [],
            "target_quantity": "10.000",
            "available_quantity": "10.000",
            "unit": "item",
            "distance_km": None,
        }
        assert all(
            r["category"] == "food" for r in query(connection, category="food")["data"]
        )
        assert (
            next(
                r
                for r in query(connection, latitude=48.85, longitude=2.35)["data"]
                if r["id"] == need
            )["distance_km"]
            == 0
        )
        connection.execute("reset role")
        current = season(datetime.now(UTC), "Europe/Paris")
        other = "summer" if current != "summer" else "winter"
        connection.execute(
            "update public.needs set seasons=array[%s]::public.need_season[] "
            "where id=%s",
            (other, need),
        )
        assert need not in [r["id"] for r in query(connection)["data"]]
        connection.execute(
            "update public.needs set seasons='{}',active=false where id=%s", (need,)
        )
        assert need not in [r["id"] for r in query(connection)["data"]]
        connection.execute("update public.needs set active=true where id=%s", (need,))
        for field, value in (("approval_status", "pending"), ("display_address", None)):
            with connection.transaction(force_rollback=True):
                from psycopg import sql

                if field == "approval_status":
                    connection.execute(
                        "update public.associations set approval_status='pending',"
                        "approved_at=null,approved_by=null where id=%s",
                        (association,),
                    )
                else:
                    connection.execute(
                        sql.SQL(
                            "update public.associations set {}=%s where id=%s"
                        ).format(sql.Identifier(field)),
                        (value, association),
                    )
                assert need not in [r["id"] for r in query(connection)["data"]]
        signature = (
            "public.dono_public_needs(public.donation_category,"
            "double precision,double precision,integer,integer)"
        )
        for role in ("anon", "authenticated"):
            assert connection.execute(
                "select has_function_privilege(%s,%s,'EXECUTE')", (role, signature)
            ).fetchone() == (False,)
            assert connection.execute(
                "select has_table_privilege(%s,'public.needs','SELECT')", ("anon",)
            ).fetchone() == (False,)
        assert connection.execute(
            "select has_table_privilege('service_role','public.needs','SELECT')"
        ).fetchone() == (False,)
        with connection.transaction(force_rollback=True):
            connection.execute("set local role anon")
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                query(connection)
        connection.rollback()


def test_public_catalog_accounts_for_live_holds_and_expired_deadlines(
    postgres: str,
) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        need = str(data["need"])
        offer = workflow(
            connection,
            data,
            "submit",
            {
                "association_id": data["association"],
                "need_id": need,
                "expected_donation_revision": "3",
            },
        )["id"]
        workflow(
            connection,
            data,
            "decision",
            {
                "expected_revision": "1",
                "decision": "approved",
                "intake_checks": {
                    "not_medicine": True,
                    "analysis_unavailable_ack": True,
                },
                "reason": "Human inspection",
            },
            offer,
        )
        row = next(r for r in query(connection)["data"] if r["id"] == need)
        assert row["available_quantity"] == "9.000"
        connection.execute(
            "update public.needs set target_quantity=1 where id=%s", (need,)
        )
        assert need not in [r["id"] for r in query(connection)["data"]]
        connection.execute(
            "update public.donation_offers set approval_deadline=%s where id=%s",
            (datetime.now(UTC) - timedelta(seconds=1), offer),
        )
        assert (
            next(r for r in query(connection)["data"] if r["id"] == need)[
                "available_quantity"
            ]
            == "1.000"
        )
        connection.rollback()


def test_catalog_pagination_and_distance_order_do_not_require_capacity(
    postgres: str,
) -> None:
    with psycopg.connect(postgres) as connection:
        near = setup(connection)
        far = setup(connection)
        connection.execute(
            "update public.associations set name='B public' where id=%s",
            (near["association"],),
        )
        connection.execute(
            "update public.associations set name='A public',latitude=45.76,"
            "longitude=4.83 where id=%s",
            (far["association"],),
        )
        connection.execute(
            "update public.capacity set limit_storage_units=0 where association_id=%s",
            (near["association"],),
        )
        connection.execute(
            "update public.slots set active=false where association_id=%s",
            (near["association"],),
        )
        first = query(connection, limit=1)
        assert first["has_more"] is True
        assert first["data"][0]["id"] == str(far["need"])
        second = query(connection, limit=1, offset=1)
        assert second["data"][0]["id"] == str(near["need"])
        distances = query(connection, latitude=48.85, longitude=2.35)
        ids = [row["id"] for row in distances["data"]]
        assert ids.index(str(near["need"])) < ids.index(str(far["need"]))
        assert query(connection, offset=100000)["data"] == []
        connection.rollback()


def location_query(connection, *, city=None, postcode=None, limit=50, offset=0):
    return connection.execute(
        "select public.dono_public_needs_in_location(%s,%s,%s,%s,%s,%s,%s)",
        ("clothes", 47.75, 7.34, limit, offset, city, postcode),
    ).fetchone()[0]


def test_location_filters_town_and_postcode_before_pagination(postgres: str) -> None:
    payload = (
        Path(__file__).parents[2] / "supabase/changes/public_needs_location.sql"
    ).read_text()
    with psycopg.connect(postgres) as connection:
        connection.execute(payload)
        records = []
        for address in (
            "1 Rue de Mulhouse 75001 Paris",
            "2 Rue de Paris 68100 Mulhouse",
            "3 Rue du Centre 68100 Riedisheim",
            "4 Rue du Centre 68200 Mulhouse",
            "68100 Rue du Centre 75002 Paris",
            "Legacy unknown address",
        ):
            data = setup(connection)
            connection.execute(
                "update public.associations set display_address=%s where id=%s",
                (address, data["association"]),
            )
            records.append(str(data["need"]))
        connection.execute("set local role service_role")
        town = location_query(connection, city="Mulhouse")
        assert {row["id"] for row in town["data"]} == {records[1], records[3]}
        assert town["has_more"] is False
        paris = location_query(connection, city="Paris")
        assert {row["id"] for row in paris["data"]} == {records[0], records[4]}
        postcode = location_query(connection, postcode="68100")
        assert {row["id"] for row in postcode["data"]} == {records[1], records[2]}
        first = location_query(connection, city="Mulhouse", limit=1)
        second = location_query(connection, city="Mulhouse", limit=1, offset=1)
        assert first["has_more"] is True
        assert second["has_more"] is False
        assert {first["data"][0]["id"], second["data"][0]["id"]} == {
            records[1],
            records[3],
        }
        assert len(location_query(connection)["data"]) == 6
        assert location_query(connection, city="Unknown")["data"] == []
        connection.rollback()


@pytest.mark.parametrize("city", ["Saint-Étienne", "SAINT ETIENNE", "saintétienne"])
def test_location_city_normalizes_accents_case_and_separators(postgres, city) -> None:
    payload = (
        Path(__file__).parents[2] / "supabase/changes/public_needs_location.sql"
    ).read_text()
    with psycopg.connect(postgres) as connection:
        connection.execute(payload)
        data = setup(connection)
        connection.execute(
            "update public.associations set display_address=%s where id=%s",
            ("2 Rue du Centre 42000 Saint-Étienne", data["association"]),
        )
        assert [row["id"] for row in location_query(connection, city=city)["data"]] == [
            str(data["need"])
        ]
        connection.rollback()


@pytest.mark.parametrize(
    ("city", "postcode"), [("Mulhouse", "68100"), ("", None), (None, "68")]
)
def test_location_rpc_rejects_invalid_or_combined_filters(postgres, city, postcode):
    payload = (
        Path(__file__).parents[2] / "supabase/changes/public_needs_location.sql"
    ).read_text()
    with psycopg.connect(postgres) as connection:
        connection.execute(payload)
        with pytest.raises(psycopg.errors.RaiseException, match="validation_error"):
            location_query(connection, city=city, postcode=postcode)
        connection.rollback()
