"""Explicit consent and scoped discovery against real PostgreSQL."""

from uuid import uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_workflow_database import one, setup


def listing(c, data, **kw):
    return one(
        c,
        "select public.dono_posted_donations(%s,%s,%s,%s,%s,%s)",
        (
            data["admin"],
            data["association"],
            kw.get("category"),
            kw.get("radius", 25),
            kw.get("limit", 10),
            kw.get("offset", 0),
        ),
    )


def analysis(c, data):
    photos = [
        str(row[0])
        for row in c.execute(
            "select id from public.donation_photos where donation_id=%s",
            (data["item"],),
        ).fetchall()
    ]
    started = one(
        c,
        "select public.dono_analysis_start(%s,%s,%s,%s)",
        (data["donor"], uuid4(), data["item"], Jsonb({"photo_ids": photos})),
    )
    one(
        c,
        "select public.dono_analysis_finish(%s,%s,%s,%s,%s,%s)",
        (
            data["donor"],
            started["id"],
            started["attempt_id"],
            Jsonb(
                {
                    "category": "clothes",
                    "confidence": 0.9,
                    "extracted": {},
                    "indicators": [
                        {
                            "key": "looks_like_medicine",
                            "probability": 0.1,
                            "level": "low",
                        }
                    ],
                }
            ),
            "test",
            False,
        ),
    )


def post(c, data, key=None, revision="3", action="posting"):
    return one(
        c,
        "select public.dono_posting(%s,%s,%s,%s,%s)",
        (
            data["donor"],
            key or uuid4(),
            data["item"],
            action,
            Jsonb(
                {
                    "expected_revision": revision,
                    "locality": "Paris",
                    "latitude": 48.85,
                    "longitude": 2.35,
                }
            ),
        ),
    )


def test_explicit_posting_consent_and_scoped_projection(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        assert listing(c, data)["data"] == []
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="ineligible_item"),
        ):
            post(c, data)
        analysis(c, data)
        key = uuid4()
        assert post(c, data, key)["replay"] is False
        assert post(c, data, key)["replay"] is True
        row = listing(c, data)["data"][0]
        assert row["id"] == data["item"]
        assert row["distance_km"] == 0
        assert row["locality"] == "Paris"
        assert "raw_label" not in row["expiry"]
        assert "donor_id" not in row
        assert len(row["photos"]) == 1
        assert listing(c, data, category="food")["data"] == []
        c.execute(
            "update public.donations set facts_revision=facts_revision+1 where id=%s",
            (data["item"],),
        )
        assert listing(c, data)["data"] == []
        assert one(c, "select count(*) from private.donation_postings") == 0


def scoped_photo(c, data, photo=None):
    photo = photo or one(
        c, "select id from public.donation_photos where donation_id=%s", (data["item"],)
    )
    return one(
        c,
        "select public.dono_posted_photo(%s,%s,%s,%s)",
        (data["admin"], data["association"], data["item"], photo),
    )


def test_posting_access_revocation_and_label_isolation(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        # Add a label before analysis so the successful analysis covers both photos.
        item_photo = one(
            c,
            "select id from public.donation_photos where donation_id=%s",
            (data["item"],),
        )
        label = one(
            c,
            "insert into public.donation_photos(donation_id,mime_type,size_byt"
            "es,sha256,kind,uploaded_by) select "
            "donation_id,mime_type,size_bytes,sha256,'label',uploaded_by from "
            "public.donation_photos where id=%s returning id",
            (item_photo,),
        )
        c.execute(
            "insert into private.photo_contents select %s,image_base64 from "
            "private.photo_contents where photo_id=%s",
            (label, item_photo),
        )
        analysis(c, data)
        post(c, data)
        assert len(listing(c, data)["data"][0]["photos"]) == 1
        assert scoped_photo(c, data, item_photo)["image_base64"]
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="not_found"),
        ):
            scoped_photo(c, data, label)
        outsider = dict(data, admin=data["donor"])
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="forbidden"),
        ):
            listing(c, outsider)
        c.execute(
            "update public.association_members set active=false where "
            "association_id=%s and profile_id=%s",
            (data["association"], data["admin"]),
        )
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="forbidden"),
        ):
            listing(c, data)
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="forbidden"),
        ):
            scoped_photo(c, data, item_photo)


@pytest.mark.parametrize(
    "reason",
    ["late_medicine", "late_cold", "owner_disabled", "withdraw_restore", "offer"],
)
def test_hidden_donations_and_photos_stay_scoped(postgres, reason):
    from test_workflow_database import workflow

    with psycopg.connect(postgres) as c:
        data = setup(c)
        analysis(c, data)
        post(c, data)
        if reason.startswith("late_"):
            key = (
                "looks_like_medicine"
                if reason == "late_medicine"
                else "chilled_or_frozen"
            )
            c.execute(
                "insert into public.donation_indicators(analysis_id,key,probabilit"
                "y,level,source_provider,source_model) select "
                "id,%s,0.9,'high','openai','test' from public.donation_analysis "
                "where donation_id=%s on conflict(analysis_id,key) do update set "
                "probability=0.9,level='high'",
                (key, data["item"]),
            )
        elif reason == "owner_disabled":
            c.execute(
                "update public.profiles set disabled_at=clock_timestamp() where id=%s",
                (data["donor"],),
            )
        elif reason == "withdraw_restore":
            c.execute(
                "update public.donations set status='withdrawn' where id=%s",
                (data["item"],),
            )
            c.execute(
                "update public.donations set status='ready' where id=%s",
                (data["item"],),
            )
        else:
            workflow(
                c,
                data,
                "submit",
                {
                    "expected_donation_revision": "4",
                    "association_id": str(data["association"]),
                    "need_id": str(data["need"]),
                },
            )
            c.execute(
                "update public.donation_offers set "
                "review_deadline=clock_timestamp()-interval '1 second' where "
                "donation_id=%s",
                (data["item"],),
            )
        assert listing(c, data)["data"] == []
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="not_found"),
        ):
            scoped_photo(c, data)


def test_human_correction_then_posting_and_radius_pagination(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        analysis(c, data)
        facts = one(c, "select private.source_facts(%s)", (data["item"],))
        one(
            c,
            "select public.dono_item(%s,%s,'edit',%s,%s)",
            (
                data["donor"],
                uuid4(),
                data["item"],
                Jsonb({"expected_revision": "3", "facts": facts}),
            ),
        )
        post(c, data, revision="4")
        assert len(listing(c, data)["data"]) == 1
        assert listing(c, data, offset=1)["data"] == []
        c.execute(
            "update private.donation_postings set latitude=49.5 where donation_id=%s",
            (data["item"],),
        )
        assert listing(c, data, radius=25)["data"] == []
        assert len(listing(c, data, radius=100)["data"]) == 1
        c.execute(
            "update public.associations set latitude=null,longitude=null where id=%s",
            (data["association"],),
        )
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="association_location_required"),
        ):
            listing(c, data)


def test_ready_item_with_missing_required_facts_cannot_post(postgres):
    with psycopg.connect(postgres) as c:
        data = setup(c)
        analysis(c, data)
        c.execute(
            "update public.donations set attributes='{}' where id=%s", (data["item"],)
        )
        with (
            c.transaction(force_rollback=True),
            pytest.raises(psycopg.Error, match="ineligible_item"),
        ):
            post(c, data)
