"""Closed workflow request contracts."""

from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from app.analysis.schemas.models import ClosedModel
from app.api.models import Revision, RevisionAction


class Origin(ClosedModel):
    latitude: Annotated[float, Field(ge=-90, le=90)]
    longitude: Annotated[float, Field(ge=-180, le=180)]


class MatchInput(ClosedModel):
    origin: Origin | None = None
    address: Annotated[str, Field(min_length=1, max_length=240)] | None = None

    @model_validator(mode="after")
    def one_origin(self) -> Self:
        if (self.origin is None) == (self.address is None):
            raise ValueError("provide exactly one origin or address")
        return self


class Submit(ClosedModel):
    expected_donation_revision: Revision
    association_id: UUID
    need_id: UUID


class IntakeChecks(ClosedModel):
    not_medicine: Literal[True]
    eligible_individual_food: Literal[True] | None = None
    analysis_unavailable_ack: Literal[True] | None = None
    date_label_correction_confirmed: Literal[True] | None = None
    date_review_ack: Literal[True] | None = None
    ddm_passed_ack: Literal[True] | None = None


class Decision(RevisionAction):
    decision: Literal["approved", "refused"]
    intake_checks: IntakeChecks | None = None
    reason: Annotated[str, Field(min_length=1, max_length=240)] | None = None


class Cancellation(RevisionAction):
    reason: Annotated[str, Field(min_length=1, max_length=240)]


class Book(ClosedModel):
    expected_offer_revision: Revision
    slot_id: UUID


class DateChecks(ClosedModel):
    date_label_correction_confirmed: Literal[True] | None = None
    date_review_ack: Literal[True] | None = None
    ddm_passed_ack: Literal[True] | None = None


class Reception(RevisionAction):
    payload: Annotated[str, Field(max_length=2048)]
    confirm_full_received: Literal[True]
    date_checks: DateChecks | None = None
    reason: Annotated[str, Field(min_length=1, max_length=240)] | None = None


class Distribution(ClosedModel):
    confirm_full_distribution: Literal[True]
    date_checks: DateChecks | None = None
    reason: Annotated[str, Field(min_length=1, max_length=240)] | None = None


class QRInput(ClosedModel):
    payload: Annotated[str, Field(max_length=2048)]


class WithdrawalInput(RevisionAction):
    reason: Annotated[str, Field(min_length=1, max_length=240)] | None = None
