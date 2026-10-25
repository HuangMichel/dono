"""Competing real transactions must serialize through the association mutex."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import psycopg
from psycopg.types.json import Jsonb
from test_workflow_database import one, setup, workflow

from app.api.models import Facts


def test_two_reviewers_cannot_over_reserve_storage(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        connection.execute(
            (
                "update public.capacity set limit_storage"
                "_units=2 where association_id=%s"
            ),
            (data["association"],),
        )
        staff = uuid4()
        connection.execute("insert into auth.users values(%s)", (staff,))
        one(
            connection,
            "select public.dono_profile(%s,%s,%s,%s)",
            (staff, uuid4(), "bootstrap", Jsonb({})),
        )
        one(
            connection,
            "select public.dono_association(%s,%s,%s,%s,%s)",
            (
                data["admin"],
                uuid4(),
                "grant",
                data["association"],
                Jsonb({"profile_id": str(staff), "role": "assoc_staff"}),
            ),
        )
        offers = []
        for index in range(2):
            if index:
                # Reuse validated immutable bytes through a new ordinary upload command.
                facts = Facts(
                    category="clothes",
                    attributes={"type": "coat"},
                    quantity="1",
                    unit="item",
                ).model_dump(mode="json")
                item = one(
                    connection,
                    "select public.dono_item(%s,%s,%s,%s,%s)",
                    (data["donor"], uuid4(), "create", None, Jsonb({"facts": facts})),
                )["id"]
                photo = connection.execute(
                    (
                        "select p.mime_type,p.size_bytes,p.sha256"
                        ",p.kind,c.image_base64 from public.donat"
                        "ion_photos p join private.photo_contents"
                        " c on c.photo_id=p.id where p.donation_i"
                        "d=%s"
                    ),
                    (data["item"],),
                ).fetchone()
                one(
                    connection,
                    "select public.dono_photo(%s,%s,%s,%s)",
                    (
                        data["donor"],
                        uuid4(),
                        item,
                        Jsonb(
                            dict(
                                zip(
                                    (
                                        "mime_type",
                                        "size_bytes",
                                        "sha256",
                                        "kind",
                                        "image_base64",
                                    ),
                                    photo,
                                    strict=False,
                                )
                            )
                        ),
                    ),
                )
                one(
                    connection,
                    "select public.dono_item(%s,%s,%s,%s,%s)",
                    (
                        data["donor"],
                        uuid4(),
                        "publication",
                        item,
                        Jsonb({"expected_revision": "2"}),
                    ),
                )
                data["item"] = item
            offers.append(
                workflow(
                    connection,
                    data,
                    "submit",
                    {
                        "association_id": data["association"],
                        "need_id": str(data["need"]),
                        "expected_donation_revision": "3",
                    },
                )["id"]
            )

    def approve(arguments: tuple) -> str:
        actor, offer = arguments
        try:
            with psycopg.connect(postgres) as connection:
                connection.execute("set local lock_timeout='5s'")
                one(
                    connection,
                    ("select public.dono_offer_command(%s,%s,%" "s,%s,%s,%s,%s)"),
                    (
                        actor,
                        uuid4(),
                        "decision",
                        None,
                        offer,
                        Jsonb(
                            {
                                "expected_revision": "1",
                                "decision": "approved",
                                "intake_checks": {
                                    "not_medicine": True,
                                    "analysis_unavailable_ack": True,
                                },
                                "reason": "Reviewed",
                            }
                        ),
                        Jsonb(data["guard"]),
                    ),
                )
            return "approved"
        except psycopg.Error as exc:
            return exc.diag.message_primary

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(
            pool.map(approve, zip((data["admin"], staff), offers, strict=False))
        )
    assert sorted(outcomes) == ["approved", "storage_exhausted"]
    with psycopg.connect(postgres) as connection:
        assert (
            one(
                connection,
                ("select private.storage_used(%s,'clothes'" ",clock_timestamp())"),
                (data["association"],),
            )
            == 2
        )
        assert (
            one(
                connection,
                "select private.need_used(%s,clock_timestamp())",
                (data["need"],),
            )
            == 1
        )


def test_competing_bookings_cannot_overbook_last_place_or_quota(postgres: str) -> None:
    for resource in ("place", "quota"):
        with psycopg.connect(postgres) as connection:
            first, second = setup(connection), setup(connection)
            second.update(
                association=first["association"],
                need=first["need"],
                slot=first["slot"],
                admin=first["admin"],
            )
            if resource == "quota":
                connection.execute(
                    ("update public.slots set max_bookings=2 where id=%s"),
                    (first["slot"],),
                )
                connection.execute(
                    (
                        "update public.intake_quotas set limit_quantity=1 where "
                        "association_id=%s"
                    ),
                    (first["association"],),
                )
            attempts = []
            for data in (first, second):
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
                        "reason": "Physically checked",
                    },
                    offer,
                )
                data["guard"]["offer_revision"] = 2
                attempts.append((data, offer))

        def book(args: tuple) -> str:
            data, offer = args
            try:
                with psycopg.connect(postgres) as connection:
                    connection.execute("set local lock_timeout='5s'")
                    workflow(
                        connection,
                        data,
                        "book",
                        {"expected_offer_revision": "2", "slot_id": str(data["slot"])},
                        offer,
                    )
                return "booked"
            except psycopg.Error as exc:
                return exc.diag.message_primary

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(book, attempts))
        assert sorted(outcomes) == [
            "booked",
            "slot_full" if resource == "place" else "intake_quota_exhausted",
        ]
        with psycopg.connect(postgres) as connection:
            assert (
                one(
                    connection,
                    "select private.slot_used(%s,clock_timestamp())",
                    (first["slot"],),
                )
                == 1
            )
