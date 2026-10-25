"""Real transactional flow, independent budgets and historical-state invariants."""

import base64
from datetime import UTC, timedelta
from hashlib import sha256
from uuid import uuid4

import psycopg
from psycopg.types.json import Jsonb

from app.api.models import Facts
from app.domain.expiry import day_fence


def one(connection: psycopg.Connection, sql: str, args: tuple = ()):
    return connection.execute(sql, args or None).fetchone()[0]


def setup(connection: psycopg.Connection) -> dict:
    donor, admin, platform = uuid4(), uuid4(), uuid4()
    for actor in (donor, admin, platform):
        connection.execute("insert into auth.users values(%s)", (actor,))
        one(
            connection,
            "select public.dono_profile(%s,%s,%s,%s)",
            (actor, uuid4(), "bootstrap", Jsonb({})),
        )
    connection.execute(
        "update public.profiles set platform_role='platform_admin' where id=%s",
        (platform,),
    )
    association = one(
        connection,
        "select public.dono_association(%s,%s,%s,%s,%s)",
        (
            admin,
            uuid4(),
            "create",
            None,
            Jsonb({"name": "Test association", "rna": "W" + str(uuid4().int)[:9]}),
        ),
    )["id"]
    one(
        connection,
        "select public.dono_association(%s,%s,%s,%s,%s)",
        (platform, uuid4(), "approval", association, Jsonb({"expected_revision": "1"})),
    )
    connection.execute(
        "update public.associations set display_address='Test "
        "address',latitude=48.85,longitude=2.35 where id=%s",
        (association,),
    )
    need = one(
        connection,
        (
            "insert into public.needs(association_id,category,attributes,"
            "seasons,target_quantity,unit,active,created_by,"
            "storage_units_per_item) values(%s,'clothes','{}','{}',10,"
            "'item',true,%s,2) returning id"
        ),
        (association, admin),
    )
    connection.execute(
        "insert into "
        "public.capacity(association_id,category,storage_unit,limit_storage_units) "
        "values(%s,'clothes','item_slot',6)",
        (association,),
    )
    now = one(connection, "select clock_timestamp()").astimezone(UTC)
    slot = one(
        connection,
        "insert into "
        "public.slots(association_id,starts_at,ends_at,max_bookings,active) "
        "values(%s,%s,%s,1,true) returning id",
        (association, now + timedelta(minutes=1), now + timedelta(minutes=31)),
    )
    day = one(
        connection,
        "select (%s::timestamptz at time zone 'Europe/Paris')::date",
        (now + timedelta(minutes=1),),
    )
    connection.execute(
        (
            "insert into public.intake_quotas(association_id,category,"
            "service_date,unit,limit_quantity) values(%s,'clothes',%s,"
            "'item',2)"
        ),
        (association, day),
    )
    facts = Facts(
        name="Winter coat",
        category="clothes",
        attributes={"type": "coat"},
        quantity="1",
        unit="item",
    ).model_dump(mode="json")
    item = one(
        connection,
        "select public.dono_item(%s,%s,%s,%s,%s)",
        (donor, uuid4(), "create", None, Jsonb({"facts": facts})),
    )["id"]
    content = b"test image already validated by API adapter"
    one(
        connection,
        "select public.dono_photo(%s,%s,%s,%s)",
        (
            donor,
            uuid4(),
            item,
            Jsonb(
                {
                    "kind": "item",
                    "mime_type": "image/png",
                    "size_bytes": len(content),
                    "sha256": sha256(content).hexdigest(),
                    "image_base64": base64.b64encode(content).decode(),
                }
            ),
        ),
    )
    one(
        connection,
        "select public.dono_item(%s,%s,%s,%s,%s)",
        (donor, uuid4(), "publication", item, Jsonb({"expected_revision": "2"})),
    )
    start, end = day_fence(now, "Europe/Paris")
    guard = {
        "need_revision": 1,
        "day_start": start.isoformat(),
        "day_end": end.isoformat(),
        "analysis_ids": [],
        "offer_revision": 1,
    }
    return dict(
        donor=donor,
        admin=admin,
        association=association,
        need=need,
        item=item,
        slot=slot,
        guard=guard,
    )


def workflow(
    connection: psycopg.Connection,
    data: dict,
    action: str,
    body: dict,
    offer: str | None = None,
    key=None,
):
    return one(
        connection,
        "select public.dono_offer_command(%s,%s,%s,%s,%s,%s,%s)",
        (
            (
                data["donor"]
                if action in ("submit", "book", "withdraw")
                else data["admin"]
            ),
            key or uuid4(),
            action,
            data["item"] if action == "submit" else None,
            offer,
            Jsonb(body),
            Jsonb(data["guard"]),
        ),
    )


def test_full_lot_receipt_distribution_and_retry(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        offer = workflow(
            connection,
            data,
            "submit",
            {
                "association_id": data["association"],
                "need_id": str(data["need"]),
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
                "reason": "Physical facts checked",
            },
            offer,
        )
        assert (
            one(
                connection,
                "select private.need_used(%s,clock_timestamp())",
                (data["need"],),
            )
            == 1
        )
        assert (
            one(
                connection,
                "select private.storage_used(%s,'clothes',clock_timestamp())",
                (data["association"],),
            )
            == 2
        )
        data["guard"]["offer_revision"] = 2
        outcome = workflow(
            connection,
            data,
            "book",
            {"expected_offer_revision": "2", "slot_id": str(data["slot"])},
            offer,
        )
        booking = outcome["booking_id"]
        nonce = one(
            connection, "select qr_nonce from public.bookings where id=%s", (booking,)
        )
        # Clock-controlled fixture: move only the slot start into the receipt window.
        connection.execute(
            "update public.slots set starts_at=clock_timestamp()-interval '1 "
            "minute' where id=%s",
            (data["slot"],),
        )
        data["guard"].update(offer_revision=3, qr_nonce=str(nonce))
        key = uuid4()
        receipt = one(
            connection,
            "select public.dono_stock_command(%s,%s,%s,%s,%s,%s,%s)",
            (
                data["admin"],
                key,
                "receive",
                booking,
                None,
                Jsonb({"expected_revision": "1", "confirm_full_received": True}),
                Jsonb(data["guard"]),
            ),
        )
        assert (
            one(
                connection,
                "select status from public.donations where id=%s",
                (data["item"],),
            )
            == "transferred"
        )
        replay = one(
            connection,
            "select public.dono_stock_command(%s,%s,%s,%s,%s,%s,%s)",
            (
                data["admin"],
                key,
                "receive",
                booking,
                None,
                Jsonb({"expected_revision": "1", "confirm_full_received": True}),
                Jsonb(data["guard"]),
            ),
        )
        assert replay["id"] == receipt["id"]
        data["guard"]["offer_revision"] = 4
        one(
            connection,
            "select public.dono_stock_command(%s,%s,%s,%s,%s,%s,%s)",
            (
                data["admin"],
                uuid4(),
                "distribute",
                None,
                receipt["id"],
                Jsonb({"confirm_full_distribution": True}),
                Jsonb(data["guard"]),
            ),
        )
        assert (
            one(
                connection,
                "select private.storage_used(%s,'clothes',clock_timestamp())",
                (data["association"],),
            )
            == 0
        )
        assert (
            one(
                connection,
                "select private.need_used(%s,clock_timestamp())",
                (data["need"],),
            )
            == 1
        )
        assert (
            one(
                connection,
                "select count(*) from public.inventory_movements where donation_id=%s",
                (data["item"],),
            )
            == 2
        )
        connection.rollback()


def test_refusal_reuses_donation_and_preserves_history(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        body = {
            "association_id": data["association"],
            "need_id": str(data["need"]),
            "expected_donation_revision": "3",
        }
        first = workflow(connection, data, "submit", body)["id"]
        workflow(
            connection,
            data,
            "decision",
            {
                "expected_revision": "1",
                "decision": "refused",
                "reason": "Need unsuitable",
            },
            first,
        )
        second = workflow(connection, data, "submit", body)["id"]
        assert first != second
        assert (
            one(
                connection,
                "select decision from public.donation_offers where id=%s",
                (first,),
            )
            == "refused"
        )
        assert (
            one(
                connection,
                "select count(*) from public.donation_offers where donation_id=%s",
                (data["item"],),
            )
            == 2
        )
        connection.rollback()
