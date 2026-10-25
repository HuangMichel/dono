"""Explicit REST output contracts; private database payloads have no DTO."""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal, TypeVar
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    PlainSerializer,
    model_serializer,
    model_validator,
)

from app.api.models import Facts


def utc_instant(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return value.astimezone(UTC)


UTCInstant = Annotated[
    datetime,
    AfterValidator(utc_instant),
    PlainSerializer(
        lambda value: value.isoformat().replace("+00:00", "Z"), return_type=str
    ),
]


class RowDTO(BaseModel):
    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def wire_numbers(cls, value: Any) -> Any:
        if isinstance(value, dict):
            value = dict(value)
            for key in (
                "revision",
                "facts_revision",
                "base_revision",
                "offer_revision",
                "input_facts_revision",
                "size_bytes",
            ):
                if value.get(key) is not None:
                    value[key] = str(value[key])
            for key in (
                "quantity",
                "target_quantity",
                "limit_quantity",
                "remaining_quantity",
            ):
                if value.get(key) is not None:
                    value[key] = f"{Decimal(str(value[key])):.3f}"
        return value


class IndicatorSource(RowDTO):
    provider: Literal["openai", "jev"]
    model: str
    analysis_id: UUID | None = None
    category: str | None = None


class IndicatorDTO(RowDTO):
    key: str
    value: str | None = None
    probability: float | None = None
    level: Literal["low", "medium", "high"] | None = None
    source: IndicatorSource

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        result = {"key": self.key, "source": self.source.model_dump(exclude_none=True)}
        for key in ("value", "probability", "level"):
            value = getattr(self, key)
            if value is not None:
                result[key] = value
        return result


class ExpiryDTO(RowDTO):
    as_of: UTCInstant
    timezone: str
    reference_date: date
    effective_expiry_date: date | None
    days_left: int | None
    expired: bool | None
    bucket: Literal[
        "expired",
        "today",
        "lt_7",
        "lt_30",
        "lt_90",
        "at_90",
        "gt_90",
        "unknown",
        "not_applicable",
    ]
    policy_version: Literal["expiry-v1"]
    unknown_reason: str | None
    date_basis: str
    required_date_checks: list[str]
    distribution_restriction: str | None
    fefo_group: int | None


class DonationComputed(RowDTO):
    expiry: ExpiryDTO
    active_offer_id: UUID | None
    inventory_state: Literal["unreceived", "in_stock", "distributed"]


class OfferComputed(RowDTO):
    effective_state: str
    holds_until: UTCInstant | None
    expiry: ExpiryDTO
    analysis_status: str
    manual_review_required: bool
    category_mismatch: bool | None


class BookingComputed(RowDTO):
    effective_state: str
    starts_at: UTCInstant
    ends_at: UTCInstant


class AnalysisComputed(RowDTO):
    classification_status: Literal["certain", "uncertain"]
    evidence_conflict: bool
    manual_review_required: bool


class ProfileDTO(RowDTO):
    id: UUID
    display_name: str | None
    platform_role: Literal["donor", "platform_admin"]
    revision: str
    created_at: UTCInstant
    updated_at: UTCInstant


class AssociationDTO(RowDTO):
    id: UUID
    name: str
    registered_by: UUID
    rna: str | None
    siret: str | None
    approval_status: Literal["pending", "approved"]
    approved_by: UUID | None
    approved_at: UTCInstant | None
    display_address: str | None
    latitude: float | None
    longitude: float | None
    timezone: str
    opening_hours: dict[str, Any] | list[Any]
    revision: str
    created_at: UTCInstant
    updated_at: UTCInstant


class MembershipDTO(RowDTO):
    association_id: UUID
    profile_id: UUID
    role: Literal["assoc_admin", "assoc_staff"]
    active: bool
    created_at: UTCInstant
    revision: str
    updated_at: UTCInstant


class MembershipEventDTO(RowDTO):
    id: UUID
    association_id: UUID
    profile_id: UUID
    action: Literal[
        "bootstrap",
        "activate",
        "grant",
        "role_change",
        "revoke",
        "transfer",
        "recovery",
    ]
    role_before: Literal["assoc_admin", "assoc_staff"] | None
    role_after: Literal["assoc_admin", "assoc_staff"]
    active_before: bool
    active_after: bool
    actor_id: UUID
    reason: str | None
    created_at: UTCInstant


class NeedDTO(RowDTO):
    id: UUID
    association_id: UUID
    category: Literal["clothes", "shoes", "food", "para", "furniture"]
    attributes: dict[str, Any] | list[Any]
    seasons: list[str]
    target_quantity: str
    unit: Literal["item"]
    active: bool
    source_text: str | None
    created_by: UUID
    revision: str
    created_at: UTCInstant
    updated_at: UTCInstant
    storage_units_per_item: int
    computed: dict[str, Any]


class CapacityDTO(RowDTO):
    association_id: UUID
    category: Literal["clothes", "shoes", "food", "para", "furniture"]
    storage_unit: Literal["item_slot"]
    limit_storage_units: int
    revision: str
    updated_at: UTCInstant
    computed: dict[str, Any]


class QuotaDTO(RowDTO):
    association_id: UUID
    category: Literal["clothes", "shoes", "food", "para", "furniture"]
    service_date: date
    unit: Literal["item"]
    limit_quantity: str
    revision: str
    updated_at: UTCInstant
    computed: dict[str, Any]


class SlotDTO(RowDTO):
    id: UUID
    association_id: UUID
    starts_at: UTCInstant
    ends_at: UTCInstant
    max_bookings: int
    active: bool
    revision: str
    created_at: UTCInstant
    updated_at: UTCInstant
    computed: dict[str, Any]


class PostingSummary(BaseModel):
    posted_at: UTCInstant
    locality: str


class DonationDTO(RowDTO):
    id: UUID
    donor_id: UUID
    basis_analysis_id: UUID | None
    status: Literal["draft", "ready", "withdrawn", "transferred"]
    revision: str
    created_at: UTCInstant
    updated_at: UTCInstant
    facts_revision: str
    facts_origin: Literal["empty", "human", "ai_seeded"]
    posting: PostingSummary | None = None
    facts: Facts
    computed: DonationComputed


class PhotoDTO(RowDTO):
    id: UUID
    donation_id: UUID
    mime_type: str
    size_bytes: str
    sha256: str
    kind: Literal["item", "label"]
    created_at: UTCInstant
    content_url: str


class AnalysisDTO(RowDTO):
    id: UUID
    donation_id: UUID
    provider: Literal["openai", "jev", "hybrid"]
    model: str
    category: Literal["clothes", "shoes", "food", "para", "furniture"]
    extracted: dict[str, Any] | list[Any]
    confidence: float
    input_photos: dict[str, Any] | list[Any]
    input_facts_revision: str
    provenance: dict[str, Any] | list[Any]
    created_at: UTCInstant
    request_id: UUID
    indicators: list[IndicatorDTO]
    computed: AnalysisComputed


class EditDTO(RowDTO):
    id: UUID
    donation_id: UUID
    actor_id: UUID | None
    basis_analysis_id: UUID | None
    base_revision: str
    before_snapshot: dict[str, Any] | list[Any]
    after_snapshot: dict[str, Any] | list[Any]
    created_at: UTCInstant
    change_kind: Literal[
        "created",
        "facts_edited",
        "published",
        "withdrawn",
        "restored",
        "transferred",
        "analysis_seeded",
    ]
    from_state: Literal["draft", "ready", "withdrawn", "transferred"] | None
    to_state: Literal["draft", "ready", "withdrawn", "transferred"]


class OfferDTO(RowDTO):
    id: UUID
    donation_id: UUID
    association_id: UUID
    need_id: UUID
    category: Literal["clothes", "shoes", "food", "para", "furniture"]
    quantity: str
    unit: Literal["item"]
    facts_revision: str
    facts_snapshot: Facts
    evidence_snapshot: dict[str, Any] | list[Any]
    basis_analysis_id: UUID | None
    status: Literal[
        "pending_review",
        "approved",
        "refused",
        "withdrawn",
        "cancelled",
        "expired",
        "fulfilled",
    ]
    decision: Literal["approved", "refused"] | None
    decided_by: UUID | None
    decided_at: UTCInstant | None
    intake_checks: dict[str, Any] | list[Any] | None
    storage_units_per_item: int | None
    review_deadline: UTCInstant
    approval_deadline: UTCInstant | None
    closed_at: UTCInstant | None
    revision: str
    created_at: UTCInstant
    updated_at: UTCInstant
    policy_version: str
    computed: OfferComputed


class OfferEventDTO(RowDTO):
    id: UUID
    offer_id: UUID
    association_id: UUID
    offer_revision: str
    from_state: (
        Literal[
            "pending_review",
            "approved",
            "refused",
            "withdrawn",
            "cancelled",
            "expired",
            "fulfilled",
        ]
        | None
    )
    to_state: Literal[
        "pending_review",
        "approved",
        "refused",
        "withdrawn",
        "cancelled",
        "expired",
        "fulfilled",
    ]
    reason: Literal[
        "submitted",
        "human_approved",
        "human_refused",
        "booked",
        "donor_withdrawal",
        "staff_cancellation",
        "booking_cancelled",
        "review_timeout",
        "booking_timeout",
        "no_show",
        "received",
    ]
    note: str | None
    actor_id: UUID | None
    effective_at: UTCInstant
    recorded_at: UTCInstant


class BookingDTO(RowDTO):
    id: UUID
    donation_id: UUID
    association_id: UUID
    slot_id: UUID
    created_at: UTCInstant
    offer_id: UUID
    category: Literal["clothes", "shoes", "food", "para", "furniture"]
    quota_date: date
    status: Literal["booked", "cancelled", "no_show", "received"]
    receivable_until: UTCInstant
    dropoff_address: str
    timezone: str
    closed_at: UTCInstant | None
    closed_by: UUID | None
    close_reason: str | None
    revision: str
    policy_version: str
    computed: BookingComputed


class MovementDTO(RowDTO):
    id: UUID
    donation_id: UUID
    association_id: UUID
    movement_type: Literal["receipt", "distribution"]
    quantity: str
    unit: Literal["item"]
    actor_id: UUID
    created_at: UTCInstant
    offer_id: UUID
    booking_id: UUID


class RedirectDTO(RowDTO):
    id: UUID
    kind: Literal["pharmacy", "textile_bin", "repair_cafe"]
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    url: str | None


class SlotOptionDTO(RowDTO):
    id: UUID
    starts_at: UTCInstant
    ends_at: UTCInstant
    quota_date: date


class ApprovalDTO(RowDTO):
    association: AssociationDTO
    membership: MembershipDTO


class RecoveryDTO(RowDTO):
    membership: MembershipDTO
    event_id: UUID


class TransferDTO(RowDTO):
    initiator: MembershipDTO
    target: MembershipDTO
    event_ids: list[UUID]


class AnalysisResultDTO(RowDTO):
    analysis: AnalysisDTO
    basis_attached: bool
    facts_seeded: bool
    current_facts_revision: str


class EvidenceDTO(RowDTO):
    offer_id: UUID
    photos: list[PhotoDTO]
    analyses: list[AnalysisDTO]
    edits: list[EditDTO]
    requests: list[dict[str, str]]
    category_mismatch: bool | None
    manual_review_required: bool
    as_of: UTCInstant


class ReconciliationDTO(RowDTO):
    offer_ids: list[UUID]
    booking_ids: list[UUID]
    has_more: bool


class CancellationDTO(RowDTO):
    booking: BookingDTO
    offer: OfferDTO


class QRDTO(RowDTO):
    booking_id: UUID
    payload: str
    format: Literal["dono.booking.v1"]
    valid_until: UTCInstant


class ArrivalDTO(RowDTO):
    booking: BookingDTO
    offer: OfferDTO


class ResolveDTO(ArrivalDTO):
    receivable: bool
    blocking_codes: list[str]


class ReceptionDTO(ArrivalDTO):
    receipt: MovementDTO
    donation_state: Literal["transferred"]


class StockLotDTO(RowDTO):
    receipt: MovementDTO
    offer: OfferDTO
    inventory_state: Literal["in_stock", "distributed"]
    remaining_quantity: str
    expiry: ExpiryDTO


class GalleryDTO(RowDTO):
    lot: StockLotDTO
    photos: list[PhotoDTO]
    indicators: list[IndicatorDTO]


class ExpiryCountsDTO(RowDTO):
    scope: Literal["received_undistributed"]
    as_of: UTCInstant
    timezone: str
    reference_date: date
    policy_version: Literal["expiry-v1"]
    buckets: list[dict[str, Any]]
    expired_count: int
    unknown_count: int
    unreadable_count: int
    not_applicable_count: int


class MatchDTO(RowDTO):
    association: dict[str, Any]
    need_id: UUID
    distance_km: float
    reasons: list[str]
    budgets: dict[str, Any]
    as_of: UTCInstant


class ParsedNeedDTO(RowDTO):
    draft: dict[str, Any]
    warnings: list[str]


class Meta(RowDTO):
    request_id: UUID
    idempotent_replay: bool | None = None
    as_of: UTCInstant | None = None

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        result: dict[str, Any] = {"request_id": self.request_id}
        if self.idempotent_replay is not None:
            result["idempotent_replay"] = self.idempotent_replay
        if self.as_of is not None:
            result["as_of"] = self.as_of
        return result


class PageMeta(RowDTO):
    request_id: UUID
    as_of: UTCInstant
    policy_version: str


class PageInfo(RowDTO):
    next_cursor: str | None
    has_more: bool


T = TypeVar("T")


class Single[T](RowDTO):
    data: T
    meta: Meta


class Page[T](RowDTO):
    data: list[T]
    page: PageInfo
    meta: PageMeta
