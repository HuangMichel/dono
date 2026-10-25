"""Frozen evidence privacy and delayed originals through real PostgreSQL RLS."""

import base64
from hashlib import sha256
from uuid import uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_analysis import payload
from test_workflow_database import one, setup, workflow

from app.api.models import Facts


def test_late_original_never_overwrites_human_or_escapes_offer_scope(
    postgres: str,
) -> None:
    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        photo = one(
            connection,
            ("select id from public.donation_photos wh" "ere donation_id=%s"),
            (data["item"],),
        )
        claim = one(
            connection,
            "select public.dono_analysis_start(%s,%s,%s,%s)",
            (data["donor"], uuid4(), data["item"], Jsonb({"photo_ids": [str(photo)]})),
        )
        facts = Facts(
            category="clothes",
            attributes={"type": "coat", "size": "L"},
            quantity="1",
            unit="item",
        ).model_dump(mode="json")
        one(
            connection,
            "select public.dono_item(%s,%s,%s,%s,%s)",
            (
                data["donor"],
                uuid4(),
                "edit",
                data["item"],
                Jsonb({"expected_revision": "3", "facts": facts}),
            ),
        )
        offer = workflow(
            connection,
            data,
            "submit",
            {
                "association_id": data["association"],
                "need_id": str(data["need"]),
                "expected_donation_revision": "4",
            },
        )["id"]
        completed = one(
            connection,
            ("select public.dono_analysis_finish(%s,%s" ",%s,%s,%s,%s)"),
            (
                data["donor"],
                claim["id"],
                claim["attempt_id"],
                Jsonb(payload("shoes")),
                "test-model",
                False,
            ),
        )
        assert completed["basis_attached"] and not completed["facts_seeded"]
        assert (
            one(
                connection,
                ("select attributes->>'size' from public.d" "onations where id=%s"),
                (data["item"],),
            )
            == "L"
        )
        assert (
            one(
                connection,
                (
                    "select facts_snapshot->'attributes'->>'s"
                    "ize' from public.donation_offers where i"
                    "d=%s"
                ),
                (offer,),
            )
            == "L"
        )
        with pytest.raises(psycopg.Error, match="immutable_evidence"):
            with connection.transaction():
                connection.execute(
                    (
                        "update public.donation_analysis set conf"
                        "idence=.01 where id=%s"
                    ),
                    (completed["id"],),
                )
        # A newly completed scoped original invalidates the earlier Python guard.
        with pytest.raises(psycopg.Error, match="date_context_stale"):
            with connection.transaction():
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
                        "reason": "Review",
                    },
                    offer,
                )
        workflow(
            connection,
            data,
            "decision",
            {"expected_revision": "1", "decision": "refused", "reason": "Re-offer"},
            offer,
        )
        other = setup(connection)
        facts["attributes"]["size"] = "S"
        one(
            connection,
            "select public.dono_item(%s,%s,%s,%s,%s)",
            (
                data["donor"],
                uuid4(),
                "edit",
                data["item"],
                Jsonb({"expected_revision": "4", "facts": facts}),
            ),
        )
        content = b"new photo for second association"
        new_photo = one(
            connection,
            "select public.dono_photo(%s,%s,%s,%s)",
            (
                data["donor"],
                uuid4(),
                data["item"],
                Jsonb(
                    {
                        "mime_type": "image/png",
                        "size_bytes": len(content),
                        "sha256": sha256(content).hexdigest(),
                        "image_base64": base64.b64encode(content).decode(),
                        "kind": "label",
                    }
                ),
            ),
        )["id"]
        future = one(
            connection,
            "select public.dono_analysis_start(%s,%s,%s,%s)",
            (data["donor"], uuid4(), data["item"], Jsonb({"photo_ids": [new_photo]})),
        )
        workflow(
            connection,
            data,
            "submit",
            {
                "association_id": other["association"],
                "need_id": str(other["need"]),
                "expected_donation_revision": "6",
            },
        )
        future_analysis = one(
            connection,
            ("select public.dono_analysis_finish(%s,%s" ",%s,%s,%s,%s)"),
            (
                data["donor"],
                future["id"],
                future["attempt_id"],
                Jsonb(payload()),
                "test-model",
                False,
            ),
        )["id"]
        connection.execute("set local role authenticated")
        connection.execute(
            ("select set_config('request.jwt.claim.sub" "',%s,true)"),
            (str(data["admin"]),),
        )
        assert (
            connection.execute(
                "select * from public.donations where id=%s", (data["item"],)
            ).fetchall()
            == []
        )
        assert (
            connection.execute(
                ("select * from public.expiry_info where d" "onation_id=%s"),
                (data["item"],),
            ).fetchall()
            == []
        )
        assert (
            one(
                connection,
                ("select count(*) from public.donation_ana" "lysis where id=%s"),
                (completed["id"],),
            )
            == 1
        )
        assert (
            one(
                connection,
                ("select count(*) from public.donation_ana" "lysis where id=%s"),
                (future_analysis,),
            )
            == 0
        )
        assert (
            one(
                connection,
                ("select count(*) from public.donation_pho" "tos where id=%s"),
                (new_photo,),
            )
            == 0
        )
        assert (
            one(
                connection,
                (
                    "select count(*) from public.donation_edi"
                    "ts where donation_id=%s and after_facts-"
                    ">'attributes'->>'size'='S'"
                ),
                (data["item"],),
            )
            == 0
        )
        connection.rollback()


def test_no_client_can_execute_writes_or_read_private_payloads(postgres: str) -> None:
    with psycopg.connect(postgres) as connection:
        assert (
            one(
                connection,
                (
                    "select count(*) from pg_proc p join pg_n"
                    "amespace n on n.oid=p.pronamespace where"
                    " n.nspname='public' and p.proname like '"
                    "dono_%' and (has_function_privilege('aut"
                    "henticated',p.oid,'execute') or has_func"
                    "tion_privilege('anon',p.oid,'execute'))"
                ),
            )
            == 0
        )
        assert (
            one(
                connection,
                (
                    "select count(*) from pg_tables where sch"
                    "emaname in ('public','private') and (has"
                    "_table_privilege('authenticated',quote_i"
                    "dent(schemaname)||'.'||quote_ident(table"
                    "name),'insert') or has_table_privilege('"
                    "authenticated',quote_ident(schemaname)||"
                    "'.'||quote_ident(tablename),'update'))"
                ),
            )
            == 0
        )
        connection.execute("set local role authenticated")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.execute("select * from private.photo_contents")


def test_false_label_approval_audits_original_ids(postgres: str) -> None:
    from app.services.workflow import (
        OfferContext,
        expiry_for,
        guard_for,
        recorded_label_correction,
    )

    with psycopg.connect(postgres) as connection:
        data = setup(connection)
        photo = one(
            connection,
            ("select id from public.donation_photos where donation_id=%s"),
            (data["item"],),
        )
        claim = one(
            connection,
            "select public.dono_analysis_start(%s,%s,%s,%s)",
            (data["donor"], uuid4(), data["item"], Jsonb({"photo_ids": [str(photo)]})),
        )
        original = payload("food")
        original["extracted"]["dates"].update(
            date_type="DLC",
            expiry_date="2027-01-23",
            date_precision="day",
            readability="readable",
            raw_label="2027-01-23",
        )
        completed = one(
            connection,
            ("select public.dono_analysis_finish(%s,%s,%s,%s,%s,%s)"),
            (
                data["donor"],
                claim["id"],
                claim["attempt_id"],
                Jsonb(original),
                "test-model",
                False,
            ),
        )
        revision = one(
            connection,
            "select revision from public.donations where id=%s",
            (data["item"],),
        )
        offer = workflow(
            connection,
            data,
            "submit",
            {
                "association_id": data["association"],
                "need_id": str(data["need"]),
                "expected_donation_revision": str(revision),
            },
        )["id"]
        context = OfferContext.model_validate(
            one(
                connection,
                "select public.dono_offer_context(%s,%s)",
                (data["admin"], offer),
            )
        )
        assert context.human_facts_confirmed
        assert (
            expiry_for(context)["distribution_restriction"]
            == "date_clarification_required"
        )
        checks = {
            "not_medicine": True,
            "analysis_unavailable_ack": True,
            "date_label_correction_confirmed": True,
        }
        reason = "Physical clothing; background date label"
        data["guard"] = guard_for(context, checks, reason, approval=True)
        workflow(
            connection,
            data,
            "decision",
            {
                "expected_revision": "1",
                "decision": "approved",
                "intake_checks": checks,
                "reason": reason,
            },
            offer,
        )
        reviewed = OfferContext.model_validate(
            one(
                connection,
                "select public.dono_offer_context(%s,%s)",
                (data["admin"], offer),
            )
        )
        assert reviewed.date_label_correction_analysis_ids == [completed["id"]]
        assert recorded_label_correction(reviewed)
        assert expiry_for(reviewed)["bucket"] == "not_applicable"
        audit = one(
            connection,
            ("select context from private.api_requests where operation=%s"),
            ("workflow/decision/" + offer,),
        )
        assert audit["reason"] == reason
        assert audit["reviewed_analysis_ids"] == [completed["id"]]
        assert not any(key in audit for key in ("days_left", "expired", "bucket"))
        assert (
            one(
                connection,
                (
                    "select extracted->'dates'->>'date_type' from "
                    "public.donation_analysis where id=%s"
                ),
                (completed["id"],),
            )
            == "DLC"
        )
