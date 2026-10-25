"""Applicant corrections and protected association intake-site configuration."""

import re
from dataclasses import asdict
from typing import Annotated, Self
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, Request
from pydantic import Field, model_validator

from app.adapters.geocoding import BANGeocoder
from app.adapters.supabase import Supabase
from app.analysis.schemas.models import ClosedModel
from app.api.associations import association
from app.api.dependencies import Actor, database, enabled
from app.api.models import Revision
from app.api.responses import AssociationDTO, Single
from app.api.workflow_shared import replay_lookup

router = APIRouter(prefix="/api/v1/associations", tags=["site"])


class Hours(ClosedModel):
    weekday: Annotated[int, Field(strict=True, ge=1, le=7)]
    start_local: Annotated[str, Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")]
    end_local: Annotated[str, Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")]


class SitePatch(ClosedModel):
    expected_revision: Revision
    name: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    rna: str | None = None
    siret: str | None = None
    address: Annotated[str, Field(min_length=1, max_length=240)] | None = None
    timezone: str | None = None
    opening_hours: list[Hours] | None = None

    @model_validator(mode="after")
    def valid(self) -> Self:
        if self.rna:
            self.rna = re.sub(r"\s", "", self.rna).upper()
            if not re.fullmatch(r"W[0-9]{9}", self.rna):
                raise ValueError("invalid RNA")
        if self.siret:
            self.siret = re.sub(r"\s", "", self.siret)
            if not re.fullmatch(r"[0-9]{14}", self.siret):
                raise ValueError("invalid SIRET")
        if self.timezone:
            try:
                ZoneInfo(self.timezone)
            except ZoneInfoNotFoundError as exc:
                raise ValueError("invalid timezone") from exc
        if self.opening_hours:
            ordered = sorted(
                self.opening_hours, key=lambda h: (h.weekday, h.start_local)
            )
            for index, interval in enumerate(ordered):
                if interval.start_local >= interval.end_local or (
                    index
                    and ordered[index - 1].weekday == interval.weekday
                    and ordered[index - 1].end_local > interval.start_local
                ):
                    raise ValueError("invalid or overlapping hours")
        return self


@router.patch("/{association_id}", response_model=Single[AssociationDTO])
async def patch(
    association_id: UUID,
    body: SitePatch,
    request: Request,
    idempotency_key: UUID = Header(),
    actor: Actor = Depends(enabled),
    db: Supabase = Depends(database),
) -> dict[str, object]:
    values = body.model_dump(mode="json", exclude_none=True)
    await association(db, actor, association_id)
    replay = await replay_lookup(
        db, actor, idempotency_key, f"site/{association_id}", values
    )
    if not replay:
        location = (
            asdict(
                await BANGeocoder(
                    request.app.state.http,
                    request.app.state.settings.geocoding_base_url,
                ).geocode(body.address)
            )
            if body.address
            else None
        )
        await db.command(
            "site",
            actor.id,
            {
                "key": str(idempotency_key),
                "tenant": str(association_id),
                "body": values,
                "location": location,
            },
        )
    return {
        "data": await association(db, actor, association_id),
        "meta": {
            "request_id": request.state.request_id,
            "idempotent_replay": bool(replay),
        },
    }
