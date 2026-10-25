// Proposed wire DTOs copied from docs/api.md. No API implementation.
export type UUID = string; // Canonical UUID text; URL IDs use the same type.
export type Instant = string; // RFC 3339 timestamp with timezone; responses use UTC Z.
export type DateOnly = string; // Valid YYYY-MM-DD source calendar date.
export type Revision = string; // Positive bigint decimal string; never a JSON float.
export type Quantity = string; // Exact numeric(12,3) decimal string, at most 9 whole + 3 fractional digits.
export type DonorKind = "individual" | "company";
export type Category = "clothes" | "shoes" | "food" | "para" | "furniture";
export type Status =
  | "draft"
  | "offered"
  | "approved"
  | "refused"
  | "booked"
  | "received"
  | "distributed";
export type Decision = "approved" | "refused";
export type Level = "low" | "medium" | "high";
export type Unit = "item"; // Initial DB-P03 quantity_unit proposal; extension requires AMB-008.
export type Season = "spring" | "summer" | "autumn" | "winter"; // Proposed need_season labels; AMB-009 remains open.
export type Attributes = Record<string, unknown>; // Closed per chosen category schema, never arbitrary executable content.
export type Single<T> = {
  data: T;
  meta: { request_id: UUID; idempotent_replay?: boolean };
};
export type Page<T> = {
  data: T[];
  page: { next_cursor: string | null; has_more: boolean };
  meta: {
    request_id: UUID;
    as_of?: Instant;
    reference_date?: DateOnly | null;
    policy_version?: string | null;
  };
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
  created_at: Instant;
};
export type HoursInterval = {
  weekday: number;
  start_local: string;
  end_local: string;
}; // Proposed ISO weekday 1–7, HH:mm, start<end.
export type Association = {
  id: UUID;
  name: string;
  registered_by: UUID;
  rna: string | null;
  siret: string | null;
  approval_status: "pending" | "approved";
  approved_by: UUID | null;
  approved_at: Instant | null;
  display_address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: "Europe/Paris";
  opening_hours: HoursInterval[];
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
};
export type AssociationListing = { id: UUID; name: string }; // Limited donor projection, no raw needs/capacity/member data.
export type Capacity = {
  association_id: UUID;
  category: Category;
  unit: Unit;
  limit_quantity: Quantity;
  revision: Revision;
  updated_at: Instant;
  computed: { reserved: Quantity; in_stock: Quantity; available: Quantity };
};
export type Need = {
  id: UUID;
  association_id: UUID;
  category: Category;
  attributes: Attributes;
  seasons: Season[] | null;
  target_quantity: Quantity;
  unit: Unit;
  active: boolean;
  source_text: string | null;
  created_by: UUID;
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
  computed: {
    pending_hold: Quantity;
    fulfilled: Quantity;
    available: Quantity;
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
  computed: { booked_count: number; remaining_places: number };
};
export type SlotOption = { id: UUID; starts_at: Instant; ends_at: Instant }; // Only available slots for this approved own offer.
export type Photo = {
  id: UUID;
  donation_id: UUID;
  kind: "item" | "label";
  mime_type: string;
  size_bytes: string;
  sha256: string;
  created_at: Instant;
  content_url: string;
}; // Relative authenticated content route.
export type Indicator = {
  key: string;
  value?: string;
  probability?: number;
  level?: Level;
  source: { provider: "openai" | "jev"; model: string };
};
export type Analysis = {
  id: UUID;
  donation_id: UUID;
  provider: "openai" | "jev" | "hybrid";
  model: string;
  category: Category;
  extracted: Record<string, unknown>;
  indicators: Indicator[];
  confidence: number;
  input_photos: { photo_id: UUID; sha256: string }[];
  input_revision: Revision;
  provenance: Record<string, unknown>;
  created_at: Instant;
};
export type ExpiryInput = {
  expiry_date: DateOnly | null;
  date_type: "DLC" | "DDM" | "expiry" | "PAO" | null;
  pao_months: number | null;
  date_precision: "day" | "month" | "year" | "unknown";
  raw_label: string | null;
  readability: "readable" | "unreadable" | "unknown";
};
export type ExpiryFacts = ExpiryInput & {
  donation_id: UUID;
  edited_by: UUID | null;
  updated_at: Instant;
};
export type ExpiryRead = {
  reference_date: DateOnly | null;
  timezone: "Europe/Paris";
  days_left: number | null;
  expired: boolean | null;
  bucket_key: string | null;
  date_status:
    "known" | "unknown" | "unreadable" | "ambiguous" | "not_applicable";
  policy_status: "configured" | "unresolved";
  policy_version: string | null;
};
export type IntakeChecks = {
  not_medicine: boolean | null;
  food_nonperishable_room_temperature: boolean | null;
  packaged_unopened: boolean | null;
};
export type Donation = {
  id: UUID;
  donor_id: UUID;
  donor_kind: DonorKind;
  company_name: string | null;
  association_id: UUID | null;
  need_id: UUID | null;
  category: Category | null;
  attributes: Attributes;
  quantity: Quantity | null;
  unit: Unit | null;
  basis_analysis_id: UUID | null;
  status: Status;
  decision: Decision | null;
  decided_by: UUID | null;
  decided_at: Instant | null;
  intake_checks: IntakeChecks | null;
  offered_at: Instant | null;
  revision: Revision;
  created_at: Instant;
  updated_at: Instant;
};
export type Mismatch = {
  analysis_id: UUID;
  original_category: Category;
  working_category: Category;
};
export type IndicatorWarning = {
  code: "medicine_concern" | "cold_food_concern";
  analysis_id: UUID;
  level: Level | null;
  redirect_kind: "pharmacy" | null;
};
export type DonationDetail = {
  donation: Donation;
  basis_analysis: Analysis | null;
  photos: Photo[];
  expiry_facts: ExpiryFacts | null;
  expiry: ExpiryRead;
  category_mismatch: Mismatch | null;
  warnings: IndicatorWarning[];
};
export type Edit = {
  id: UUID;
  donation_id: UUID;
  actor_id: UUID;
  basis_analysis_id: UUID | null;
  base_revision: Revision;
  before_facts: Record<string, unknown>;
  after_facts: Record<string, unknown>;
  created_at: Instant;
};
export type Match = {
  association: AssociationListing;
  need_id: UUID;
  category: Category;
  distance_km: number;
  reasons: ("need_matches" | "capacity_available" | "season_matches")[];
};
export type Booking = {
  id: UUID;
  donation_id: UUID;
  association_id: UUID;
  slot_id: UUID;
  qr_expires_at: Instant;
  created_at: Instant;
};
export type BookingDetail = {
  booking: Booking;
  slot: SlotOption;
  dropoff_address: string;
  donation_status: Status;
};
export type Qr = { booking_id: UUID; payload: string; expires_at: Instant };
export type Movement = {
  id: UUID;
  donation_id: UUID;
  association_id: UUID;
  movement_type: "receipt" | "distribution";
  quantity: Quantity;
  unit: Unit;
  actor_id: UUID;
  created_at: Instant;
};
export type Reception = {
  booking: Booking;
  donation: Donation;
  movement: Movement;
};
export type Distribution = {
  donation: Donation;
  movement: Movement;
  remaining_quantity: Quantity;
};
export type InventoryItem = {
  donation: Donation;
  received_quantity: Quantity;
  distributed_quantity: Quantity;
  remaining_quantity: Quantity;
  unit: Unit;
  expiry: ExpiryRead;
};
export type GalleryItem = {
  donation_id: UUID;
  category: Category | null;
  photos: Photo[];
  basis_analysis: Analysis | null;
  category_mismatch: Mismatch | null;
  expiry: ExpiryRead;
};
export type ExpirySummary = {
  reference_date: DateOnly | null;
  timezone: "Europe/Paris";
  policy_version: string | null;
  bucket_mode: "cumulative" | "exclusive" | null;
  bucket_catalog: { key: string; label: string }[] | null;
  counts: Record<string, number> | null;
  total_items: number;
  unknown_dates: number;
};
export type RedirectPoint = {
  id: UUID;
  kind: "pharmacy" | "textile_bin" | "repair_cafe";
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
};

export type ProfilePatch = {
  expected_revision: Revision;
  display_name: string | null;
};
export type AssociationCreate = {
  name: string;
  rna?: string | null;
  siret?: string | null;
  display_address?: string | null;
}; // At least one provided RNA/SIRET under DB-P01.
export type AssociationPatch = {
  expected_revision: Revision;
  name?: string;
  display_address?: string | null;
  opening_hours?: HoursInterval[];
}; // Address is geocoded server-side.
export type AssociationApproval = {
  expected_revision: Revision;
  approved: true;
}; // No rejection/reversal workflow inferred.
export type NeedInput = {
  category: Category;
  attributes: Attributes;
  seasons: Season[] | null;
  target_quantity: Quantity;
  unit: Unit;
  active?: boolean;
  source_text?: string | null;
};
export type NeedPatch = { expected_revision: Revision } & Partial<NeedInput>;
export type NeedParse = { text: string };
export type NeedDraft = {
  draft: Partial<NeedInput>;
  source_text: string;
  warnings: { path: string; code: string }[];
};
export type CapacityPut = {
  expected_revision: Revision | null;
  unit: Unit;
  limit_quantity: Quantity;
}; // NULL=create only.
export type SlotInput = {
  starts_at: Instant;
  ends_at: Instant;
  max_bookings: number;
  active?: boolean;
};
export type SlotPatch = { expected_revision: Revision } & Partial<SlotInput>;
export type DonationCreate = {
  donor_kind?: DonorKind;
  company_name?: string | null;
  category?: Category;
  attributes?: Attributes;
  quantity?: Quantity;
  unit?: Unit;
};
export type DonationPatch = {
  expected_revision: Revision;
  donor_kind?: DonorKind;
  company_name?: string | null;
  category?: Category;
  attributes?: Attributes;
  quantity?: Quantity;
  unit?: Unit;
  expiry?: ExpiryInput;
};
export type AnalysisCreate = { expected_revision: Revision; photo_ids: UUID[] };
export type LocationInput = { address: string }; // Proposed request-scoped location, privacy/radius policy AMB-009/016.
export type MatchRequest = {
  location: LocationInput;
  limit?: number;
  cursor?: string;
};
export type OfferCreate = {
  expected_revision: Revision;
  association_id: UUID;
  need_id: UUID;
  location: LocationInput;
};
export type DecisionCreate = {
  expected_revision: Revision;
  decision: Decision;
  intake_checks: IntakeChecks;
};
export type BookingCreate = { expected_revision: Revision; slot_id: UUID };
export type QrResolve = { payload: string };
export type ReceptionCreate = {
  expected_revision: Revision;
  payload: string;
  received_quantity: Quantity;
  confirm_received: true;
};
export type DistributionCreate = {
  expected_revision: Revision;
  quantity: Quantity;
  unit: Unit;
};
