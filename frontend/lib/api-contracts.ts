// Wire types for the implemented FastAPI contract in docs/api.md.
export type UUID = string;
export type Instant = string; // RFC3339, UTC Z responses
export type DateOnly = string; // YYYY-MM-DD source date
export type Revision = string; // positive bigint decimal, never floating point
export type Quantity = string; // exact numeric(12,3), integral item quantities in MVP
// Positive item/offer/movement quantities; nonnegative limits/balances.
export type Category = "clothes" | "shoes" | "food" | "para" | "furniture";
export type Unit = "item";
export type StorageUnit = "item_slot";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type DonationState = "draft" | "ready" | "withdrawn" | "transferred";
export type OfferState =
  | "pending_review"
  | "approved"
  | "refused"
  | "withdrawn"
  | "cancelled"
  | "expired"
  | "fulfilled";
export type BookingState = "booked" | "cancelled" | "no_show" | "received";
export type InventoryState = "unreceived" | "in_stock" | "distributed"; // derived, no status column
export type Decision = "approved" | "refused"; // human only
export type Attributes = Record<string, unknown>; // exact closed category keys/types in analysis-rules.md; optional human keys normalize to null
// attributes = domain facts (size/product/condition), not generic metadata.
export type Single<T> = {
  data: T;
  meta: { request_id: UUID; idempotent_replay?: boolean; as_of?: Instant };
};
export type Page<T> = {
  data: T[];
  page: { next_cursor: string | null; has_more: boolean };
  meta: { request_id: UUID; as_of: Instant; policy_version: string };
};
export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id: UUID;
    retryable: boolean;
    details?: { path: string; code: string }[];
    ambiguity_ids?: string[];
  };
};

export type Profile = {
  id: UUID;
  display_name: string | null;
  platform_role: "donor" | "platform_admin";
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
};
export type Membership = {
  association_id: UUID;
  profile_id: UUID;
  role: "assoc_admin" | "assoc_staff";
  active: boolean;
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
};
export type MembershipEvent = {
  id: UUID;
  association_id: UUID;
  profile_id: UUID;
  actor_id: UUID;
  action:
    | "bootstrap"
    | "activate"
    | "grant"
    | "role_change"
    | "revoke"
    | "transfer"
    | "recovery";
  role_before: "assoc_admin" | "assoc_staff" | null;
  role_after: "assoc_admin" | "assoc_staff";
  active_before: boolean;
  active_after: boolean;
  reason: string | null;
  created_at: Instant;
};
export type HoursInterval = {
  weekday: number;
  start_local: string;
  end_local: string;
}; // ISO 1–7, HH:mm
// Intervals nonoverlapping, start<end; slots fit one local date and its configured interval.
export type Association = {
  id: UUID;
  registered_by: UUID;
  name: string;
  rna: string | null;
  siret: string | null;
  approval_status: "pending" | "approved";
  approved_by: UUID | null;
  approved_at: Instant | null;
  display_address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  opening_hours: HoursInterval[];
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
};
export type AssociationListing = {
  id: UUID;
  name: string;
  display_address: string;
}; // public-to-user projection only
export type Capacity = {
  association_id: UUID;
  category: Category;
  storage_unit: StorageUnit;
  limit_storage_units: number;
  revision: Revision;
  updated_at: Instant;
  computed: {
    reserved_storage_units: number;
    occupied_storage_units: number;
    available_storage_units: number;
  };
};
export type Need = {
  id: UUID;
  association_id: UUID;
  category: Category;
  attributes: Attributes;
  seasons: Season[];
  target_quantity: Quantity;
  unit: Unit;
  storage_units_per_item: number;
  active: boolean;
  source_text: string | null;
  created_by: UUID;
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
  computed: {
    held_quantity: Quantity;
    fulfilled_quantity: Quantity;
    available_quantity: Quantity;
  };
};
export type IntakeQuota = {
  association_id: UUID;
  category: Category;
  service_date: DateOnly;
  unit: Unit;
  limit_quantity: Quantity;
  revision: Revision;
  updated_at: Instant;
  computed: {
    booked_quantity: Quantity;
    received_quantity: Quantity;
    available_quantity: Quantity;
  };
};
export type Slot = {
  id: UUID;
  association_id: UUID;
  starts_at: Instant;
  ends_at: Instant;
  max_bookings: number;
  active: boolean;
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
  computed: {
    booked_count: number;
    received_count: number;
    remaining_places: number;
  };
};
export type SlotOption = {
  id: UUID;
  starts_at: Instant;
  ends_at: Instant;
  quota_date: DateOnly;
};
export type Photo = {
  id: UUID;
  donation_id: UUID;
  kind: "item" | "label";
  mime_type: string;
  size_bytes: string;
  sha256: string;
  created_at: Instant;
  content_url: string;
}; // authenticated relative URL
// Metadata only. Base64 text stays in private.photo_contents; content_url serves authorized decoded bytes.
export type Indicator = {
  key: string;
  value?: string;
  probability?: number;
  level?: "low" | "medium" | "high";
  source: { provider: "openai" | "jev"; model: string };
};
export type Analysis = {
  id: UUID;
  donation_id: UUID;
  request_id: UUID;
  provider: "openai" | "jev" | "hybrid";
  model: string;
  category: Category;
  extracted: Record<string, unknown>;
  indicators: Indicator[];
  confidence: number;
  input_photos: { photo_id: UUID; sha256: string }[];
  input_facts_revision: Revision;
  provenance: Record<string, unknown>;
  created_at: Instant;
  computed: {
    classification_status: "certain" | "uncertain";
    evidence_conflict: boolean;
    manual_review_required: boolean;
  };
};
export type SourceDates = {
  expiry_date: DateOnly | null;
  raw_label: string | null;
  date_type: "DLC" | "DDM" | "expiry" | "PAO" | null;
  pao_months: number | null;
  opened_on: DateOnly | null;
  date_precision: "day" | "month" | "year" | "unknown";
  readability: "readable" | "unreadable" | "unknown";
};
export type ExpiryBucket =
  | "expired"
  | "today"
  | "lt_7"
  | "lt_30"
  | "lt_90"
  | "at_90"
  | "gt_90"
  | "unknown"
  | "not_applicable";
export type ExpiryUnknownReason =
  | "missing_date"
  | "unreadable_date"
  | "ambiguous_date"
  | "conflicting_dates"
  | "invalid_date"
  | "category_date_conflict"
  | "incomplete_strict_date"
  | "date_type_unknown"
  | "opening_state_unknown"
  | "opening_date_missing"
  | "invalid_opening_date"
  | "pao_duration_missing"
  | "opened_food";
export type DateReviewChecks = {
  date_label_correction_confirmed?: true;
  date_review_ack?: true;
  ddm_passed_ack?: true;
};
export type ExpiryView = {
  as_of: Instant;
  timezone: string;
  reference_date: DateOnly;
  effective_expiry_date: DateOnly | null;
  days_left: number | null;
  expired: boolean | null;
  bucket: ExpiryBucket;
  policy_version: "expiry-v1";
  unknown_reason: ExpiryUnknownReason | null;
  date_basis:
    | "exact"
    | "period_end"
    | "pao"
    | "earliest_limit"
    | "pao_unopened"
    | "not_applicable"
    | "unknown";
  required_date_checks: ("date_review_ack" | "ddm_passed_ack")[];
  distribution_restriction:
    "date_passed" | "date_clarification_required" | "opened_food" | null;
  fefo_group: 0 | 1 | 2 | 3 | null;
}; // group only for actual stock; all fields computed in Python, never stored
// Exactly one bucket; date passed is not equivalent to unsafe or a human decision.
export type Facts = {
  category: Category | null;
  attributes: Attributes;
  quantity: Quantity | null;
  unit: Unit | null;
  expiry: SourceDates;
};
export type OfferedFacts = Facts & {
  category: Category;
  quantity: Quantity;
  unit: Unit;
}; // validated ready snapshot
export type Donation = {
  id: UUID;
  donor_id: UUID;
  status: DonationState;
  facts: Facts;
  facts_origin: "empty" | "human" | "ai_seeded";
  facts_revision: Revision;
  revision: Revision;
  basis_analysis_id: UUID | null;
  created_at: Instant;
  updated_at: Instant;
  computed: {
    expiry: ExpiryView;
    active_offer_id: UUID | null;
    inventory_state: InventoryState;
  };
};
export type DonationEdit = {
  id: UUID;
  donation_id: UUID;
  actor_id: UUID | null;
  base_revision: string;
  basis_analysis_id: UUID | null;
  change_kind:
    | "created"
    | "facts_edited"
    | "published"
    | "withdrawn"
    | "restored"
    | "transferred"
    | "analysis_seeded";
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  from_state: DonationState | null;
  to_state: DonationState | null;
  created_at: Instant;
};
export type EvidenceScope = {
  photos: { photo_id: UUID; sha256: string }[];
  analysis_request_ids: UUID[];
  edit_ids: UUID[];
};
export type Offer = {
  id: UUID;
  donation_id: UUID;
  association_id: UUID;
  need_id: UUID;
  category: Category;
  quantity: Quantity;
  unit: Unit;
  facts_revision: Revision;
  facts_snapshot: OfferedFacts;
  evidence_snapshot: EvidenceScope;
  basis_analysis_id: UUID | null;
  status: OfferState;
  decision: Decision | null;
  decided_by: UUID | null;
  decided_at: Instant | null;
  intake_checks: IntakeChecks | null;
  storage_units_per_item: number | null;
  review_deadline: Instant;
  approval_deadline: Instant | null;
  closed_at: Instant | null;
  policy_version: string;
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
  computed: {
    effective_state: OfferState;
    holds_until: Instant | null;
    expiry: ExpiryView;
    analysis_status: "none" | "pending" | "available" | "unavailable";
    manual_review_required: boolean;
    category_mismatch: boolean | null;
  };
};
export type OfferEvent = {
  id: UUID;
  offer_id: UUID;
  association_id: UUID;
  offer_revision: Revision;
  from_state: OfferState | null;
  to_state: OfferState;
  reason:
    | "submitted"
    | "human_approved"
    | "human_refused"
    | "booked"
    | "donor_withdrawal"
    | "staff_cancellation"
    | "booking_cancelled"
    | "review_timeout"
    | "booking_timeout"
    | "no_show"
    | "received";
  actor_id: UUID | null;
  note: string | null;
  effective_at: Instant;
  recorded_at: Instant;
};
export type Evidence = {
  offer_id: UUID;
  photos: Photo[];
  analyses: Analysis[];
  edits: DonationEdit[];
  requests: { id: UUID; state: "pending" | "succeeded" | "unavailable" }[];
  category_mismatch: boolean | null;
  manual_review_required: boolean;
  as_of: Instant;
};
export type IntakeChecks = DateReviewChecks & {
  not_medicine: true;
  eligible_individual_food?: true;
  analysis_unavailable_ack?: true;
};
// analysis_unavailable_ack historically names manual review: also required for low/unknown/conflicting/mismatched evidence.
export type Booking = {
  id: UUID;
  offer_id: UUID;
  donation_id: UUID;
  association_id: UUID;
  slot_id: UUID;
  category: Category;
  quota_date: DateOnly;
  status: BookingState;
  receivable_until: Instant;
  dropoff_address: string;
  timezone: string;
  closed_at: Instant | null;
  closed_by: UUID | null;
  close_reason: string | null;
  revision: Revision;
  policy_version: string;
  created_at: Instant;
  computed: {
    effective_state: BookingState;
    starts_at: Instant;
    ends_at: Instant;
  };
};
export type QR = {
  booking_id: UUID;
  payload: string;
  format: "dono.booking.v1";
  valid_until: Instant;
};
// Signed payload contains version/key ID/booking ID/association ID/nonce/deadline, no donor PII.
// Signature alone is insufficient: authenticate, resolve current state/tenant/nonce and receipt window.
export type Movement = {
  id: UUID;
  donation_id: UUID;
  offer_id: UUID;
  booking_id: UUID;
  association_id: UUID;
  movement_type: "receipt" | "distribution";
  quantity: Quantity;
  unit: Unit;
  actor_id: UUID;
  created_at: Instant;
};
export type StockLot = {
  receipt: Movement;
  offer: Offer;
  inventory_state: "in_stock" | "distributed";
  remaining_quantity: Quantity;
  expiry: ExpiryView;
};
export type Match = {
  association: AssociationListing;
  need_id: UUID;
  distance_km: number;
  reasons: string[];
  budgets: {
    demand_available: Quantity;
    storage_available: number;
    storage_units_per_item: number;
    intake_available: Quantity;
    earliest_slot_id: UUID;
  };
  as_of: Instant;
};
export type RedirectPoint = {
  id: UUID;
  name: string;
  kind: "pharmacy" | "textile_bin" | "repair_cafe";
  address: string;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
};
export type ReceptionResult = {
  booking: Booking;
  offer: Offer;
  receipt: Movement;
  donation_state: "transferred";
};

export type ExpiryCounts = {
  scope: "received_undistributed";
  as_of: Instant;
  timezone: string;
  reference_date: DateOnly;
  policy_version: "expiry-v1";
  buckets: { key: ExpiryBucket; count: number }[]; // every key once, policy order, including zero counts
  expired_count: number;
  unknown_count: number;
  unreadable_count: number;
  not_applicable_count: number;
};

export type PublicNeed = {
  id: UUID;
  association: { id: UUID; name: string; display_address: string };
  category: Category;
  attributes: Attributes;
  seasons: string[];
  target_quantity: Quantity;
  available_quantity: Quantity;
  unit: Unit;
  distance_km: number | null;
};
