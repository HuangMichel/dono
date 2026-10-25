"""Item identity persists through edits, analysis and frozen recipient offers."""

from uuid import uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_analysis import payload
from test_posted_donations_database import analysis, listing, post
from test_workflow_database import one, setup, workflow

from app.api.models import Facts


def edit(c, data, facts, revision="3"):
    return one(
        c,
        "select public.dono_item(%s,%s,'edit',%s,%s)",
        (
            data["donor"],
            uuid4(),
            data["item"],
            Jsonb({"expected_revision": revision, "facts": facts}),
        ),
    )


def test_details_persist_in_owner_posted_and_frozen_offer_facts(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        facts = one(c, "select private.source_facts(%s)", (data["item"],))
        facts.update(name="Blue winter coat", description="Small tear at the cuff.")
        edit(c, data, facts)
        analysis(c, data)
        post(c, data, revision="4")
        row = listing(c, data)["data"][0]
        assert row["name"] == "Blue winter coat"
        assert row["description"] == "Small tear at the cuff."
        offer = workflow(
            c,
            data,
            "submit",
            {
                "expected_donation_revision": "5",
                "association_id": str(data["association"]),
                "need_id": str(data["need"]),
            },
        )
        snapshot = one(
            c,
            "select facts_snapshot from public.donation_offers where id=%s",
            (offer["id"],),
        )
        assert snapshot["name"] == "Blue winter coat"
        assert snapshot["description"] == "Small tear at the cuff."
        # Current item changes must not rewrite the recipient's frozen evidence.
        c.execute(
            "update public.donations set name='Later title' where id=%s",
            (data["item"],),
        )
        assert (
            one(
                c,
                "select facts_snapshot from public.donation_offers where id=%s",
                (offer["id"],),
            )
            == snapshot
        )


def test_nameless_item_cannot_publish_offer_or_post(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        analysis(c, data)
        c.execute("update public.donations set name=null where id=%s", (data["item"],))
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="ineligible_item"),
        ):
            post(c, data)
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="ineligible_item"),
        ):
            workflow(
                c,
                data,
                "submit",
                {
                    "expected_donation_revision": "3",
                    "association_id": str(data["association"]),
                    "need_id": str(data["need"]),
                },
            )
        c.execute(
            "update public.donations set status='draft' where id=%s", (data["item"],)
        )
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="ineligible_item"),
        ):
            one(
                c,
                "select public.dono_item(%s,%s,'publication',%s,%s)",
                (
                    data["donor"],
                    uuid4(),
                    data["item"],
                    Jsonb({"expected_revision": "3"}),
                ),
            )


def test_metadata_only_draft_allows_ai_seed_without_overwriting_identity(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        # Full API-shaped defaults must still count as identity-only input.
        facts = Facts(name="Donor title", description="Donor description").model_dump(
            mode="json"
        )
        item = one(
            c,
            "select public.dono_item(%s,%s,'create',null,%s)",
            (data["donor"], uuid4(), Jsonb({"facts": facts})),
        )["id"]
        assert (
            one(
                c,
                "select facts_origin::text from public.donations where id=%s",
                (item,),
            )
            == "empty"
        )
        c.execute(
            "insert into public.donation_photos(donation_id,mime_type,size_bytes,"
            "sha256,kind,uploaded_by) select %s,mime_type,size_bytes,sha256,"
            "kind,uploaded_by from public.donation_photos where donation_id=%s",
            (item, data["item"]),
        )
        photos = [
            str(row[0])
            for row in c.execute(
                "select id from public.donation_photos where donation_id=%s", (item,)
            )
        ]
        start = one(
            c,
            "select public.dono_analysis_start(%s,%s,%s,%s)",
            (data["donor"], uuid4(), item, Jsonb({"photo_ids": photos})),
        )
        result = one(
            c,
            "select public.dono_analysis_finish(%s,%s,%s,%s,'test',false)",
            (data["donor"], start["id"], start["attempt_id"], Jsonb(payload())),
        )
        assert result["facts_seeded"] is True
        stored = one(c, "select private.source_facts(%s)", (item,))
        assert stored["name"] == "Donor title"
        assert stored["description"] == "Donor description"
        assert stored["category"] == "clothes"
