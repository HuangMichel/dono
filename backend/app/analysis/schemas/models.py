"""Closed analysis-v1 contracts shared by HTTP input and provider validation."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Category = Literal["clothes", "shoes", "food", "para", "furniture"]
CATEGORIES: tuple[Category, ...] = ("clothes", "shoes", "food", "para", "furniture")
Text = Annotated[str, Field(max_length=120)]
Size = Annotated[str, Field(max_length=40)]
Probability = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False, strict=True)]
Season = Literal["spring", "summer", "autumn", "winter"]


class ClosedModel(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def blank_unknowns(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: None if isinstance(part, str) and not part.strip() else part
                for key, part in value.items()
            }
        return value

    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True, allow_inf_nan=False
    )


class Clothes(ClosedModel):
    type: (
        Literal["tshirt", "shirt", "trousers", "dress", "coat", "knitwear", "other"]
        | None
    )
    size: Size | None
    audience: Literal["adult", "child", "baby"] | None
    seasons: list[Season] | None

    @model_validator(mode="after")
    def unique_seasons(self) -> Self:
        if self.seasons is not None and len(set(self.seasons)) != len(self.seasons):
            raise ValueError("duplicate seasons")
        return self


class Shoes(ClosedModel):
    type: Literal["sneakers", "boots", "sandals", "formal", "other"] | None
    size: Size | None
    pair_complete: Annotated[bool, Field(strict=True)] | None


class Food(ClosedModel):
    product: Text | None
    brand: Text | None
    storage_condition: Literal["room_temperature", "chilled", "frozen"] | None
    non_perishable: Annotated[bool, Field(strict=True)] | None
    packaging_state: Literal["sealed", "opened"] | None


class Para(ClosedModel):
    product: Text | None
    brand: Text | None
    product_kind: Literal["hygiene", "cosmetic", "medical_device", "other"] | None
    opening_state: Literal["unopened", "opened"] | None
    seal_state: Literal["intact", "broken", "not_present"] | None


class Furniture(ClosedModel):
    type: Literal["chair", "table", "cabinet", "shelving", "other"] | None
    size_class: Literal["small", "medium", "large"] | None
    printed_dimensions: Text | None


ATTRIBUTES: dict[Category, type[ClosedModel]] = dict(
    zip(CATEGORIES, (Clothes, Shoes, Food, Para, Furniture), strict=True)
)
INDICATORS: dict[Category, tuple[str, ...]] = {
    "clothes": ("wear_visible", "stains_visible", "holes_visible", "pilling_visible"),
    "shoes": ("pair_incomplete", "sole_damage", "upper_damage", "heavy_wear"),
    "food": ("packaging_damaged", "seal_broken", "spoilage_visible"),
    "para": ("seal_broken", "packaging_damaged"),
    "furniture": ("structural_damage", "surface_damage", "visible_mould"),
}
COMMON = ("looks_like_medicine", "chilled_or_frozen", "label_unreadable")


class ModelDates(ClosedModel):
    expiry_date: date | None
    date_type: Literal["DLC", "DDM", "expiry", "PAO"] | None
    pao_months: Annotated[int, Field(strict=True, ge=1, le=120)] | None
    date_precision: Literal["day", "month", "year", "unknown"]
    raw_label: Annotated[str, Field(max_length=240)] | None
    readability: Literal["readable", "unreadable", "unknown"]

    @model_validator(mode="after")
    def consistent_source(self) -> Self:
        if self.expiry_date and (
            self.date_precision != "day" or self.readability != "readable"
        ):
            raise ValueError("exact date needs readable day precision")
        if self.date_type == "PAO" and self.expiry_date is not None:
            raise ValueError("PAO type cannot carry an absolute date")
        return self


class HumanDates(ModelDates):
    expiry_date: date | None = None
    date_type: Literal["DLC", "DDM", "expiry", "PAO"] | None = None
    pao_months: Annotated[int, Field(strict=True, ge=1, le=120)] | None = None
    date_precision: Literal["day", "month", "year", "unknown"] = "unknown"
    raw_label: Annotated[str, Field(max_length=240)] | None = None
    readability: Literal["readable", "unreadable", "unknown"] = "unknown"
    opened_on: date | None = None


class Classification(ClosedModel):
    clothes: Probability
    shoes: Probability
    food: Probability
    para: Probability
    furniture: Probability


class Extracted(ClosedModel):
    schema_version: Literal["analysis-v1"]
    classification: Classification
    attributes: Clothes | Shoes | Food | Para | Furniture
    dates: ModelDates


class WireIndicator(ClosedModel):
    key: str
    probability: Probability | None
    value: Text | None


class WireAnalysis(ClosedModel):
    category: Category
    extracted: Extracted
    confidence: Probability
    indicators: list[WireIndicator]

    @model_validator(mode="after")
    def validate_semantics(self) -> Self:
        vector = self.extracted.classification.model_dump()
        if abs(sum(Decimal(str(v)) for v in vector.values()) - Decimal(1)) > Decimal(
            "0.01"
        ):
            raise ValueError("classification sum outside tolerance")
        selected = max(CATEGORIES, key=lambda key: vector[key])
        if self.category != selected or self.confidence != vector[selected]:
            raise ValueError("classification/category/confidence mismatch")
        if type(self.extracted.attributes) is not ATTRIBUTES[self.category]:
            raise ValueError("wrong attribute branch")
        expected = set(COMMON + INDICATORS[self.category])
        if (
            len(self.indicators) != len(expected)
            or {i.key for i in self.indicators} != expected
        ):
            raise ValueError("indicator keys mismatch")
        dates = self.extracted.dates
        if self.category not in ("food", "para") and any(
            (
                dates.expiry_date,
                dates.date_type,
                dates.pao_months,
                dates.raw_label,
                dates.date_precision != "unknown",
                dates.readability != "unknown",
            )
        ):
            raise ValueError("unexpected dates for category")
        if self.category == "food" and (
            dates.date_type == "PAO" or dates.pao_months is not None
        ):
            raise ValueError("food has no PAO")
        if self.category == "para" and dates.date_type in ("DLC", "DDM"):
            raise ValueError("para absolute date uses expiry")
        if dates.expiry_date:
            from app.analysis.validation import validate_printed_date

            validate_printed_date(dates.expiry_date, dates.raw_label)
        return self
