"""Public write contracts: clients cannot assign identity, roles or AI evidence."""

from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator

from app.analysis.schemas.models import ATTRIBUTES, Category, ClosedModel, HumanDates
from app.domain.quantities import validate_quantity

Revision = Annotated[str, Field(pattern=r"^[1-9][0-9]*$")]


class Facts(ClosedModel):
    name: Annotated[str, Field(max_length=120)] | None = None
    description: Annotated[str, Field(max_length=2000)] | None = None
    category: Category | None = None
    attributes: dict[str, object] = Field(default_factory=dict)
    quantity: str | None = None
    unit: Literal["item"] | None = None
    expiry: HumanDates = Field(default_factory=HumanDates)

    @model_validator(mode="after")
    def validated_facts(self) -> Self:
        if (
            self.expiry.opened_on
            and self.expiry.opened_on > datetime.now(ZoneInfo("Europe/Paris")).date()
        ):
            raise ValueError("opening date is in the future")
        if self.quantity is not None:
            self.quantity = validate_quantity(self.quantity)
        if self.category == "food" and (
            self.expiry.date_type == "PAO"
            or self.expiry.pao_months is not None
            or self.expiry.opened_on is not None
        ):
            raise ValueError("food has no PAO")
        if self.category == "para" and self.expiry.date_type in ("DLC", "DDM"):
            raise ValueError("para absolute dates use expiry")
        if self.category:
            schema = ATTRIBUTES[self.category]
            fields: dict[str, object] = {key: None for key in schema.model_fields}
            fields.update(
                {
                    key: None if isinstance(value, str) and not value.strip() else value
                    for key, value in self.attributes.items()
                }
            )
            self.attributes = schema.model_validate(fields).model_dump()
        elif self.attributes:
            raise ValueError("attributes need a category")
        return self


class CreateDonation(ClosedModel):
    facts: Facts | None = None


class EditDonation(ClosedModel):
    expected_revision: Revision
    facts: Facts


class RevisionAction(ClosedModel):
    expected_revision: Revision


class ProfileInput(ClosedModel):
    display_name: Annotated[str, Field(max_length=120)] | None = None


class ProfileEdit(ProfileInput):
    expected_revision: Revision


class AnalysisInput(ClosedModel):
    photo_ids: Annotated[list[UUID], Field(min_length=1, max_length=3)]
    category_hint: Category | None = None

    @model_validator(mode="after")
    def unique_ids(self) -> Self:
        if len(self.photo_ids) != len(set(self.photo_ids)):
            raise ValueError("duplicate photo IDs")
        return self
