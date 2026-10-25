# Dono REST API contract

Status: **FastAPI backend implemented**; all baseline catalog method/path combinations have routes and explicit response models. Tests and remaining live integration gates are recorded in [readiness](readiness.md). Python **FastAPI** owns `/api/v1` business routes; Next.js is the frontend. There are no Next.js business Route Handlers or background workers. See [backend](../backend/app/main.py) and [migrations](../supabase/migrations/). [AGENTS.md](../AGENTS.md), [working domain defaults](domain-model.md), [requirements](requirements.md), [use cases](features.md), [schema/RLS](databases.md) and [diagrams](architecture.md) form the same design.

## Frontend integration boundary

The frontend calls FastAPI through a bearer-authenticated client for protected operations and an anonymous read helper for the public needs directory. It uses Supabase email/password authentication, provisions the donor profile, reads current memberships and renders empty/loading/error states from API responses. Runtime demo data, role switches and browser-local business persistence are removed.

The connected screens follow the implemented separate donation/offer/booking contracts, three-photo limit and full-lot receipt/distribution commands. Public needs browsing uses the limited anonymous endpoint below. Company attribution and unmatched posted offers remain unsupported API gaps and have no simulated actions. Live deployment acceptance is recorded in [readiness](readiness.md).

## Authentication, permissions and HTTP conventions

FastAPI verifies the Supabase bearer token's signature, algorithm, issuer, audience and expiry using the project's supported keys/Auth verification path. Decoding a JWT is insufficient. The frontend sends signup/sign-in email and password directly to Supabase Auth. Once a session exists, the app provisions its own donor-only profile through the bootstrap command below. A signup awaiting confirmation cannot call protected endpoints. FastAPI accepts bearer tokens, never account passwords. Role checks read current enabled profiles and database memberships; editable user metadata and stale role claims never grant authorization. Account confirmation emails may be enabled in Supabase; no donation notification, invite or messaging flow is required. [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)

| Scope | Permission |
|---|---|
| V | Public visitor; only the explicit public needs projection, without a bearer token. |
| S | Verified Auth subject; enabled existing profile, or no profile yet, for profile bootstrap only. |
| U | Authenticated, enabled application profile. |
| D | Donation owner, through its own item/offer/booking. |
| M | Current active assoc_admin or assoc_staff of the addressed **approved** association. |
| A | Current active assoc_admin of that approved association. |
| P | Protected platform_admin, only association verification and constrained orphan recovery. |
| O | Offer owner or M of that offer's target; reads the frozen offer, not unrestricted current donation facts. |
| E | Donation owner or M whose readable offer explicitly whitelists this evidence/photo/request. |
| G | Association registration applicant while pending, otherwise A. |

Every protected operation, content request and idempotency replay reauthorizes. Foreign/private IDs return 404 without existence disclosure; a known disallowed collection/capability returns 403. Donors cannot read other donors' items. Staff use offer snapshots and whitelisted evidence; previous association A cannot read later corrections/requests made for B. Platform capability confers no global donation read. Normal reads use user-JWT RLS; privileged commands implement the explicit actor/tenant guards and locks in databases.md. A server credential is not a product permission.

JSON content type is application/json; photo upload is multipart/form-data. All responses use private, no-store caching, including QR, evidence, photos and derived lists. Production may proxy `/api/v1` to FastAPI on the same origin. Separate-origin local development uses an explicit CORS frontend allowlist, required methods and Authorization/Content-Type/Idempotency-Key headers. CORS is not auth. The business API does not implicitly trust frontend cookies; a future cookie mode requires a separate CSRF design. [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)

FastAPI APIRouters group account, associations, donations, offers, bookings and inventory. Pydantic input/output models are closed, validated and explicit. Python code owns matching, arithmetic, deadlines and transactional commands; provider HTTP calls run outside database locks. No ORM requirement or event-bus infrastructure is introduced. [FastAPI structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

## Shared JSON types and command semantics

TypeScript notation describes client wire shapes, not backend implementation. A property marked `?` may be omitted; `| null` permits explicit NULL. Dates must be valid calendar values, timestamps timezone-aware and finite. Unknown fields are 422, including donor-supplied IDs/roles/AI evidence/decision fields in item writes. Request IDs, actors, target links, deadlines and provenance are server-owned.

```ts
type UUID = string;
type Instant = string; // RFC3339, UTC Z responses
type DateOnly = string; // YYYY-MM-DD source date
type Revision = string; // positive bigint decimal, never floating point
type Quantity = string; // exact numeric(12,3), integral item quantities in MVP
// Positive item/offer/movement quantities; nonnegative limits/balances.
type Category = "clothes" | "shoes" | "food" | "para" | "furniture";
type Unit = "item";
type StorageUnit = "item_slot";
type Season = "spring" | "summer" | "autumn" | "winter";
type DonationState = "draft" | "ready" | "withdrawn" | "transferred";
type OfferState = "pending_review" | "approved" | "refused" | "withdrawn" | "cancelled" | "expired" | "fulfilled";
type BookingState = "booked" | "cancelled" | "no_show" | "received";
type InventoryState = "unreceived" | "in_stock" | "distributed"; // derived, no status column
type Decision = "approved" | "refused"; // human only
type Attributes = Record<string, unknown>; // exact closed category keys/types in analysis-rules.md; optional human keys normalize to null
// attributes = domain facts (size/product/condition), not generic metadata.
type Single<T> = {data: T; meta: {request_id: UUID; idempotent_replay?: boolean; as_of?: Instant}};
type Page<T> = {data: T[]; page: {next_cursor: string | null; has_more: boolean};
  meta: {request_id: UUID; as_of: Instant; policy_version: string}};
type ErrorResponse = {error: {code: string; message: string; request_id: UUID; retryable: boolean;
  details?: {path: string; code: string}[]; ambiguity_ids?: string[]}};
```

Every persisted POST/PATCH/PUT uses Idempotency-Key: UUID. Bind it to actor, operation/path, canonical validated payload, expected version and file digest where relevant. A completed replay returns the same action/resource identity and original success status after current permission checks; reconstruct current DTOs and computed balances/expiry, rather than cache a historical mutable response. Check replay before rejecting the old expected_revision. Same key/different body is 409 idempotency_conflict. An in-progress external request is 409 request_in_progress; expired leases are fenced so only the current attempt commits. Failures are not successful evidence and external provider billing is not exactly once.

Existing mutable-resource commands require expected_revision; stale revision is 409. Append-only creation (profile bootstrap, member grant, upload, analysis request, offer/booking creation, distribution) has its own uniqueness/parent guards and does not invent a revision for a nonexistent row. Offer creation additionally sends expected_donation_revision to bind the frozen snapshot. Booking creation sends expected_offer_revision. Reconciliation has no fictitious collection revision. The private.api_requests ledger stores stable references/context, not QR payloads, secrets, raw bytes or derived expiry/balances. Evidence-referenced request context outlives ordinary retry-cache cleanup; retention remains AMB-015.

Read-like POST matching, QR resolve and needs parse do not persist product state and need no idempotency key. Analysis may use an ordinary synchronous HTTP call: first persist/fence its request context; call provider outside locks; then append result in a new transaction. Another browser request may correct/publish/offer meanwhile. The evidence endpoint exposes only whitelisted request IDs and public states pending/succeeded/unavailable; it never exposes the private ledger. No worker or queue is required. A failed response may be retried with a new request after the owner withdraws any active offer.

## Read schemas

Every route below returns Single<T> or Page<T>, except binary photo content and explicit error responses. Tables' columns and complete constraints are in databases.md. Optional computed sections are read-time projections; they are never cached as stored expiry fields.

```ts
type Profile = {id: UUID; display_name: string | null; platform_role: "donor" | "platform_admin";
  revision: Revision; created_at: Instant; updated_at: Instant};
type Membership = {association_id: UUID; profile_id: UUID; role: "assoc_admin" | "assoc_staff";
  active: boolean; revision: Revision; created_at: Instant; updated_at: Instant};
type MembershipEvent = {id: UUID; association_id: UUID; profile_id: UUID; actor_id: UUID;
  action: "bootstrap" | "activate" | "grant" | "role_change" | "revoke" | "transfer" | "recovery";
  role_before: "assoc_admin" | "assoc_staff" | null; role_after: "assoc_admin" | "assoc_staff";
  active_before: boolean; active_after: boolean; reason: string | null; created_at: Instant};
type HoursInterval = {weekday: number; start_local: string; end_local: string}; // ISO 1–7, HH:mm
// Intervals nonoverlapping, start<end; slots fit one local date and its configured interval.
type Association = {id: UUID; registered_by: UUID; name: string; rna: string | null; siret: string | null;
  approval_status: "pending" | "approved"; approved_by: UUID | null; approved_at: Instant | null;
  display_address: string | null; latitude: number | null; longitude: number | null;
  timezone: string; opening_hours: HoursInterval[]; revision: Revision; created_at: Instant; updated_at: Instant};
type AssociationListing = {id: UUID; name: string; display_address: string}; // public-to-user projection only
type Capacity = {association_id: UUID; category: Category; storage_unit: StorageUnit;
  limit_storage_units: number; revision: Revision; updated_at: Instant;
  computed: {reserved_storage_units: number; occupied_storage_units: number; available_storage_units: number}};
type Need = {id: UUID; association_id: UUID; category: Category; attributes: Attributes; seasons: Season[];
  target_quantity: Quantity; unit: Unit; storage_units_per_item: number; active: boolean;
  source_text: string | null; created_by: UUID; revision: Revision; created_at: Instant; updated_at: Instant;
  computed: {held_quantity: Quantity; fulfilled_quantity: Quantity; available_quantity: Quantity}};
type IntakeQuota = {association_id: UUID; category: Category; service_date: DateOnly; unit: Unit;
  limit_quantity: Quantity; revision: Revision; updated_at: Instant;
  computed: {booked_quantity: Quantity; received_quantity: Quantity; available_quantity: Quantity}};
type Slot = {id: UUID; association_id: UUID; starts_at: Instant; ends_at: Instant; max_bookings: number;
  active: boolean; revision: Revision; created_at: Instant; updated_at: Instant;
  computed: {booked_count: number; received_count: number; remaining_places: number}};
type SlotOption = {id: UUID; starts_at: Instant; ends_at: Instant; quota_date: DateOnly};
type Photo = {id: UUID; donation_id: UUID; kind: "item" | "label"; mime_type: string;
  size_bytes: string; sha256: string; created_at: Instant; content_url: string}; // authenticated relative URL
// Metadata only. Base64 text stays in private.photo_contents; content_url serves authorized decoded bytes.
type Indicator = {key: string; value?: string; probability?: number; level?: "low" | "medium" | "high";
  source: {provider: "openai" | "jev"; model: string}};
type Analysis = {id: UUID; donation_id: UUID; request_id: UUID; provider: "openai" | "jev" | "hybrid";
  model: string; category: Category; extracted: Record<string, unknown>; indicators: Indicator[];
  confidence: number; input_photos: {photo_id: UUID; sha256: string}[];
  input_facts_revision: Revision; provenance: Record<string, unknown>; created_at: Instant;
  computed: {classification_status: "certain"|"uncertain"; evidence_conflict: boolean; manual_review_required: boolean}};
type SourceDates = {expiry_date: DateOnly | null; raw_label: string | null;
  date_type: "DLC" | "DDM" | "expiry" | "PAO" | null; pao_months: number | null;
  opened_on: DateOnly | null; date_precision: "day" | "month" | "year" | "unknown";
  readability: "readable" | "unreadable" | "unknown"};
type ExpiryBucket = "expired" | "today" | "lt_7" | "lt_30" | "lt_90" | "at_90" | "gt_90" | "unknown" | "not_applicable";
type ExpiryUnknownReason = "missing_date" | "unreadable_date" | "ambiguous_date" | "conflicting_dates" |
  "invalid_date" | "category_date_conflict" | "incomplete_strict_date" | "date_type_unknown" | "opening_state_unknown" |
  "opening_date_missing" | "invalid_opening_date" | "pao_duration_missing" | "opened_food";
type DateReviewChecks = {date_label_correction_confirmed?: true; date_review_ack?: true; ddm_passed_ack?: true};
type ExpiryView = {as_of: Instant; timezone: string; reference_date: DateOnly;
  effective_expiry_date: DateOnly | null; days_left: number | null; expired: boolean | null;
  bucket: ExpiryBucket; policy_version: "expiry-v1"; unknown_reason: ExpiryUnknownReason | null;
  date_basis: "exact"|"period_end"|"pao"|"earliest_limit"|"pao_unopened"|"not_applicable"|"unknown";
  required_date_checks: ("date_review_ack"|"ddm_passed_ack")[];
  distribution_restriction: "date_passed"|"date_clarification_required"|"opened_food"|null;
  fefo_group: 0|1|2|3|null}; // group only for actual stock; all fields computed in Python, never stored
// Exactly one bucket; date passed is not equivalent to unsafe or a human decision.
type Facts = {category: Category | null; attributes: Attributes; quantity: Quantity | null; unit: Unit | null;
  expiry: SourceDates};
type OfferedFacts = Facts & {category: Category; quantity: Quantity; unit: Unit}; // validated ready snapshot
type Donation = {id: UUID; donor_id: UUID; status: DonationState; facts: Facts;
  facts_origin: "empty" | "human" | "ai_seeded"; facts_revision: Revision; revision: Revision;
  basis_analysis_id: UUID | null; created_at: Instant; updated_at: Instant;
  computed: {expiry: ExpiryView; active_offer_id: UUID | null; inventory_state: InventoryState}};
type DonationEdit = {id: UUID; donation_id: UUID; actor_id: UUID | null; base_revision: string;
  basis_analysis_id: UUID | null; change_kind: "created" | "facts_edited" | "published" | "withdrawn" |
    "restored" | "transferred" | "analysis_seeded";
  before_snapshot: Record<string, unknown>; after_snapshot: Record<string, unknown>;
  from_state: DonationState | null; to_state: DonationState | null; created_at: Instant};
type EvidenceScope = {photos: {photo_id: UUID; sha256: string}[]; analysis_request_ids: UUID[]; edit_ids: UUID[]};
type Offer = {id: UUID; donation_id: UUID; association_id: UUID; need_id: UUID;
  category: Category; quantity: Quantity; unit: Unit; facts_revision: Revision;
  facts_snapshot: OfferedFacts; evidence_snapshot: EvidenceScope; basis_analysis_id: UUID | null;
  status: OfferState; decision: Decision | null; decided_by: UUID | null; decided_at: Instant | null;
  intake_checks: IntakeChecks | null; storage_units_per_item: number | null;
  review_deadline: Instant; approval_deadline: Instant | null; closed_at: Instant | null;
  policy_version: string; revision: Revision; created_at: Instant; updated_at: Instant;
  computed: {effective_state: OfferState; holds_until: Instant | null; expiry: ExpiryView;
    analysis_status: "none" | "pending" | "available" | "unavailable"; manual_review_required: boolean; category_mismatch: boolean | null}};
type OfferEvent = {id: UUID; offer_id: UUID; association_id: UUID; offer_revision: Revision;
  from_state: OfferState | null; to_state: OfferState;
  reason: "submitted" | "human_approved" | "human_refused" | "booked" | "donor_withdrawal" |
    "staff_cancellation" | "booking_cancelled" | "review_timeout" | "booking_timeout" | "no_show" | "received";
  actor_id: UUID | null; note: string | null; effective_at: Instant; recorded_at: Instant};
type Evidence = {offer_id: UUID; photos: Photo[]; analyses: Analysis[]; edits: DonationEdit[];
  requests: {id: UUID; state: "pending" | "succeeded" | "unavailable"}[];
  category_mismatch: boolean | null; manual_review_required: boolean; as_of: Instant};
type IntakeChecks = DateReviewChecks & {not_medicine: true; eligible_individual_food?: true; analysis_unavailable_ack?: true};
// analysis_unavailable_ack historically names manual review: also required for low/unknown/conflicting/mismatched evidence.
type Booking = {id: UUID; offer_id: UUID; donation_id: UUID; association_id: UUID; slot_id: UUID;
  category: Category; quota_date: DateOnly; status: BookingState; receivable_until: Instant;
  dropoff_address: string; timezone: string; closed_at: Instant | null; closed_by: UUID | null;
  close_reason: string | null; revision: Revision; policy_version: string; created_at: Instant;
  computed: {effective_state: BookingState; starts_at: Instant; ends_at: Instant}};
type QR = {booking_id: UUID; payload: string; format: "dono.booking.v1"; valid_until: Instant};
// Signed payload contains version/key ID/booking ID/association ID/nonce/deadline, no donor PII.
// Signature alone is insufficient: authenticate, resolve current state/tenant/nonce and receipt window.
type Movement = {id: UUID; donation_id: UUID; offer_id: UUID; booking_id: UUID; association_id: UUID;
  movement_type: "receipt" | "distribution"; quantity: Quantity; unit: Unit; actor_id: UUID; created_at: Instant};
type StockLot = {receipt: Movement; offer: Offer; inventory_state: "in_stock" | "distributed";
  remaining_quantity: Quantity; expiry: ExpiryView};
type Match = {association: AssociationListing; need_id: UUID; distance_km: number;
  reasons: string[]; budgets: {demand_available: Quantity; storage_available: number;
  storage_units_per_item: number; intake_available: Quantity; earliest_slot_id: UUID}; as_of: Instant};
type RedirectPoint = {id: UUID; name: string; kind: "pharmacy" | "textile_bin" | "repair_cafe";
  address: string; latitude: number | null; longitude: number | null; url: string | null};
type ReceptionResult = {booking: Booking; offer: Offer; receipt: Movement; donation_state: "transferred"};
```

Analysis confidence is the selected category probability in the five-way extracted.classification distribution, not overall OCR/safety confidence. Confidence/probability are finite [0,1], original values retained without fixed-scale rounding; percentages are display formatting. Unknown confidence is absent because there is no successful result, never synthetic zero. SourceDates quantity/date extraction contains source facts only. Item expiry derivatives use code at read time from current owner facts or frozen offer facts, never a stored bucket. Operational deadlines are separately stored validity facts.

## Analysis and expiry contract defaults

[Analysis-v1](analysis-rules.md) defines exactly five attribute branches, common source-date fields and allowed indicator keys. Analysis.extracted is the closed object {schema_version, classification, attributes, dates} described there, not arbitrary unvalidated JSON. Provider-wire nulls normalize to omitted optional Indicator properties; unknown indicator keys are still represented once with no probability/level. Python assigns original level bands <0.50 / <0.80 / ≥0.80 and records analysis-v1 in provenance. Category confidence below 0.80, source conflicts, missing medicine assessment or category mismatch require manual review; they do not erase valid originals or set decision. All model/field validation and failed-provider fallback follow AN-T001–016.

SourceDates retains only facts. opened_on is human-only; model dates omit it. Partial labels keep expiry_date=null with precision/raw_label, and ambiguous numeric order is not silently normalized. Human entry of an exact ISO date is explicit source confirmation recorded by edited_by/journal. date_precision/readability remain the existing SQL enums. Para opening_state is in its category attributes. No schema column is added.

[Expiry-v1](expiry-rules.md) fixes one bucket, reason, PAO/calendar rule, DLC/DDM distinction and total FEFO order. Exact 7/30/90 days use lt_30/lt_90/at_90; today is not expired. Unknown/NA return null date/days/expired. No generic policy_required error remains for AMB-005/006/007/017. Physical commands require conditional DateReviewChecks and a nonempty human reason; strict passed/unresolved dates cannot be bypassed by acknowledgement. A typed date restriction never writes a staff refusal or changes a lifecycle automatically. Publication/manual fallback still requires complete valid human facts and explicit clarification where a strict label/PAO is unresolved before intake.

FastAPI computes date guards in Python from authorized source facts/database as_of. Existing private commands recheck source/offer revisions, completed scoped analysis IDs and the reference day's [UTC start,next local midnight) instant fence under locks. Changed facts/evidence/day returns date_context_stale for reread/recompute. The server-only guard context is not a client DTO, stored expiry cache or Python callback inside the RPC. No item-expiry arithmetic moves into Postgres.

```ts
type ExpiryCounts = {scope: "received_undistributed"; as_of: Instant; timezone: string;
  reference_date: DateOnly; policy_version: "expiry-v1";
  buckets: {key: ExpiryBucket; count: number}[]; // every key once, policy order, including zero counts
  expired_count: number; unknown_count: number; unreadable_count: number; not_applicable_count: number};
```

expired_count/unknown_count/not_applicable_count alias their bucket counts; unreadable_count is a subset of unknown, not another band to add. The nine counts sum to scoped lot count. FIFO groups for unknown/NA and separate blocked stock are explicit; counts/FEFO do not join duplicate attempts/analyses. EX-T001–033 specify expected cases. Pure source/status GETs remain available even when a physical command would be restricted.

## Public needs directory

`GET /api/v1/public/needs` has scope V and requires no account. Query parameters are optional `location` town/postcode text, `category`, `limit` default 10 and maximum 50, and `cursor`. Blank location is treated as absent. A nonblank location must contain 3–200 characters after trimming and start with a letter or number. Invalid input returns `422 invalid_location` with `retryable: false` before contacting BAN. Use a town or full postcode, such as `Mulhouse` or `68100`; `68` is too short. The response uses `Page<PublicNeed>`:

```ts
type PublicNeed = {
  id: UUID;
  association: {id: UUID; name: string; display_address: string};
  category: Category;
  attributes: Record<string, unknown>;
  seasons: string[];
  target_quantity: Quantity;
  available_quantity: Quantity;
  unit: "item";
  distance_km: number | null;
};
```

Only active, in-season needs with positive remaining demand at approved, geocoded association sites are listed. Remaining demand uses the same receipt and live-reservation calculation as matching. Without location, the order is association name and stable IDs and distance is null. With location, BAN resolves the origin. Five-digit input filters by the exact postcode; other input filters by the canonical town name returned by BAN. The database applies locality and category predicates before pagination and orders matching rows by Haversine distance, association ID and need ID. No radius or travel-time estimate applies. Invalid filters/cursors fail validation; geocoding or database failures return an explicit error.

Public search requests `type=municipality` from BAN and rejects other result types. This prevents a street named after another town from becoming the search origin. The service-only `dono_public_needs_in_location` RPC takes mutually exclusive `filter_city` and `filter_postcode` arguments. It reads the trailing postcode and municipality from the stored BAN address label. Town comparison uses the whole normalized municipality name, not street-name substrings, and allows a town to span multiple postcodes. An address without a parseable locality is excluded from location searches but remains eligible for blank browsing. Equal canonical town names in different areas can match; exact municipality-code identity would require structured locality fields and a verified backfill. The original RPC remains available for rollout compatibility; authenticated donation matching is unchanged.

A restricted server RPC returns the public fields with bounded pagination. Anonymous and authenticated Data API roles gain no table or RPC grants. Source notes, personnel identities, raw operational budgets, donor records and photos remain private. This discovery endpoint does not establish item eligibility, reserve capacity or approve a donation. All donation creation, matching and offer commands retain their account and ownership checks. See FR-039 and UC-017.

## Account, registration and membership routes

Paths below are relative to `/api/v1`. JSON schema notation uses the types above. POST returns 201 for new resources, 200 for actions; PATCH/PUT return 200. Every response is the stated Single or Page wrapper.

| Method / path | Scope | Request | Response / guards | Requirements; entities |
|---|---|---|---|---|
| POST /account/profile | S | `{display_name?: string|null}` | 201 Profile, or existing identity on replay; ID from verified subject, donor only; disabled profile cannot reactivate itself. | FR-001, FR-037; profiles |
| GET /account/profile | U | none | Profile; GET does not provision or assign roles. | FR-001; profiles |
| PATCH /account/profile | U | `{expected_revision, display_name}` | Profile; no role/disabled/identity fields. | FR-001; profiles |
| GET /account/memberships | U | pagination | Page<Membership>; own memberships including pending/inactive, no implied permission. | FR-001, FR-037; association_members |
| POST /associations | U | `{name, rna?: string, siret?: string, timezone?: string}` | 201 Association; at least one normalized identifier, uniqueness/manual verification; default timezone Europe/Paris; atomically pending + inactive applicant admin + event. | FR-002, FR-037; associations, association_members, membership_events |
| GET /associations/{associationId} | G or M or P | none | Association; P verification scope only. Donors get the limited listing through matches/booking. | FR-002; associations |
| PATCH /associations/{associationId} | G | `{expected_revision, name?, rna?, siret?, address?: string, timezone?, opening_hours?: HoursInterval[]}` | Association; pending applicant may correct identifiers/name; approved admin configures site/hours, not legal identity. Server BAN geocodes address outside locks then validates revision. Freeze timezone after any slot, address/hours with live bookings; deactivate unused invalid slots before hours changes. | FR-002, FR-006, FR-014; associations, slots, bookings |
| GET /admin/associations | P | pagination, `approval_status?` | Page<Association> for registration verification only. | FR-002; associations |
| POST /admin/associations/{associationId}/approval | P | `{expected_revision}` | Association + original applicant Membership; manual verification required; one transaction activates applicant once. No donation authority. | FR-002, FR-037; associations, association_members, membership_events |
| POST /admin/associations/{associationId}/admin-recovery | P | `{expected_revision, reason: string}` | Membership + event ID; only original enabled registered_by, only if zero active enabled admins; reason/manual verification mandatory. | FR-037; associations, association_members, membership_events, profiles |
| GET /associations/{associationId}/members | A | pagination | Page<Membership>; UUID/role/activity only, no other profiles' private fields. | FR-037; association_members |
| POST /associations/{associationId}/members | A | `{profile_id: UUID, role: "assoc_admin"|"assoc_staff"}` | 201 Membership; existing enabled account only, no email invitation/lookup; use PATCH to reactivate. | FR-037; association_members, membership_events |
| PATCH /associations/{associationId}/members/{profileId} | A | `{expected_revision, role?, active?: boolean, reason?: string}` | Membership; reason required on revocation; reject last-enabled-admin demotion/revocation; changes append events. | FR-037; association_members, membership_events |
| POST /associations/{associationId}/admin-transfer | A | `{expected_revision, target_profile_id: UUID}` | `{initiator: Membership, target: Membership, event_ids: UUID[]}`; expected revision is initiator membership; lock/recheck target; enable target admin and demote initiator staff atomically. | FR-037; association_members, membership_events |
| GET /associations/{associationId}/membership-events | A | pagination, `profile_id?` | Page<MembershipEvent>; full association audit, scoped. | FR-037; membership_events |

Ordinary members read their own membership via account/memberships. An applicant's pending admin is inactive and confers none of A/M. Normal application operations check both enabled account and current membership, serializing revocation with writes. Last-admin guard counts enabled accounts, not merely active flags. No registration rejection workflow or arbitrary platform reassignment is needed for MVP.

## Intake configuration routes

Only A writes configuration; M reads. Missing need/storage/quota/slot configuration is ineligible, never unlimited. Hours, seasons, quantities and integer storage rates follow DEC-004/009/012.

| Method / path | Scope | Request | Response / guards | Requirements; entities |
|---|---|---|---|---|
| GET /associations/{associationId}/needs | M | pagination, `active?`, `category?` | Page<Need> | FR-003, FR-034; needs, donation_offers, inventory_movements |
| POST /associations/{associationId}/needs | A | `{category, attributes, seasons: Season[], target_quantity, unit, storage_units_per_item: number, active: boolean, source_text?: string}` | 201 Need; positive integral target/rate, explicit [] means all seasons. | FR-003, FR-034; needs |
| PATCH /associations/{associationId}/needs/{needId} | A | `{expected_revision, attributes?, seasons?, target_quantity?, storage_units_per_item?, active?}` | Need; cannot reduce demand below held+fulfilled; rate edits affect future approvals, frozen existing rates remain. Category/unit immutable; deactivation stops new eligibility, not existing approvals/bookings. | FR-003, FR-034; needs, donation_offers |
| POST /associations/{associationId}/needs/parse | A | `{text: string}` | `{draft: {category?: Category, attributes: Attributes, seasons?: Season[], target_quantity?: Quantity, unit?: Unit}, warnings: string[]}`; extraction only, no stored need, no arithmetic; staff provides storage rate. | FR-004; needs |
| GET /associations/{associationId}/capacity | M | pagination | Page<Capacity>, read-time held/occupied/available storage places. | FR-005, FR-034; capacity |
| PUT /associations/{associationId}/capacity/{category} | A | `{expected_revision?: Revision, storage_unit: "item_slot", limit_storage_units: number}` | Capacity; nonnegative integer; revision required for existing row and omitted for first creation. Reject below commitments. | FR-005, FR-034; capacity |
| GET /associations/{associationId}/intake-quotas | M | pagination, `from`, `to`, `category?` | Page<IntakeQuota>; required local-date range, maximum 31 days. | FR-034; intake_quotas, bookings, inventory_movements |
| PUT /associations/{associationId}/intake-quotas/{category}/{serviceDate} | A | `{expected_revision?: Revision, unit: "item", limit_quantity: Quantity}` | IntakeQuota; same create/update revision rule; nonnegative integral limit, not below booked+received. | FR-034; intake_quotas |
| GET /associations/{associationId}/slots | M | pagination, `from`, `to`, `active?` | Page<Slot>, required instant range ≤31 days. | FR-006; slots, bookings |
| POST /associations/{associationId}/slots | A | `{starts_at, ends_at, max_bookings: number}` | 201 Slot; future valid interval, positive places, one local date/hours, no active overlap. | FR-006; slots |
| PATCH /associations/{associationId}/slots/{slotId} | A | `{expected_revision, starts_at?, ends_at?, max_bookings?, active?}` | Slot; never edit booked times once any booking history exists; places cannot fall below committed usage. active=false stops new bookings, does not cancel existing ones. | FR-006, FR-035; slots, bookings |

## Donor item, photos and analysis routes

Raw Donation and source-date reads are D only. An association does not gain unrestricted donation access by receiving an offer. Mutations of facts/photos/new analysis requests require no effective active offer and no physical transfer. Creation/edit/publication is valid with complete human facts even without an original AI basis.

| Method / path | Scope | Request | Response / guards | Requirements; entities |
|---|---|---|---|---|
| POST /donations | U | `{facts?: Facts}` | 201 Donation; donor from caller, draft state; nonempty human input marks human origin. Missing category valid only while draft. | FR-007, FR-010, FR-033; donations, expiry_info, donation_edits |
| GET /donations | D | pagination, `status?: DonationState` | Page<Donation>, own items. | FR-015, FR-025; donations |
| GET /donations/{donationId} | D | none | Donation + own active-attempt summary; no target staff access. | FR-025, FR-033; donations |
| PATCH /donations/{donationId} | D | `{expected_revision, facts: Facts}` | Donation; full validated working facts/source-date replacement, human origin and facts_revision increment; no original mutation. Freeze while effective live offer/transferred; an elapsed stale status does not block correction. | FR-010, FR-011, FR-038; donations, expiry_info, donation_edits |
| POST /donations/{donationId}/publication | D | `{expected_revision}` | Donation ready; valid category/attributes/quantity/photos, safety restrictions; AI basis optional. | FR-015, FR-038; donations, donation_edits |
| POST /donations/{donationId}/withdrawal | D | `{expected_revision, reason?: string}` | Ready Donation → withdrawn; atomically closes live offer and cancels live booking/releases unreceived holds; not after receipt. | FR-033, FR-035, FR-036; donations, donation_offers, bookings, offer_events, donation_edits |
| POST /donations/{donationId}/restoration | D | `{expected_revision}` | Donation ready; validate current facts/photos again, no old attempt reopened. | FR-036; donations, donation_edits |
| POST /donations/{donationId}/photos | D | multipart `{file, kind: "item"|"label"}` | 201 Photo; validate bytes/type/size/count and ownership before any provider; atomically store immutable metadata + canonical base64/digest; no bucket. | FR-007; donation_photos, private.api_requests, private.photo_contents |
| GET /donations/{donationId}/photos | D | pagination | Page<Photo> | FR-007; donation_photos |
| GET /photos/{photoId}/content | E | none | Authenticated binary with actual validated media type, decode private base64 text to binary, verify digest; no public URL or bucket. | FR-007, FR-016; donation_photos, private.photo_contents |
| POST /donations/{donationId}/analyses | D | `{photo_ids: UUID[], category_hint?: Category}` | 201 `{analysis: Analysis, basis_attached: boolean, facts_seeded: boolean, current_facts_revision: Revision}`; captured context/fenced commit, no new request while live offer. Delayed result may still append; seed guard below. | FR-008, FR-011, FR-038; donation_analysis, donation_indicators, private.api_requests, donations |
| GET /donations/{donationId}/analyses | D | pagination | Page<Analysis>, immutable originals and source context. | FR-008, FR-011; donation_analysis, donation_indicators |
| GET /donations/{donationId}/edits | D | pagination | Page<DonationEdit>, human facts/item disposition history. | FR-010, FR-036; donation_edits |
| POST /donations/{donationId}/matches | D | `{origin: {latitude: number, longitude: number}}` or `{address: string}` | Page<Match>; ready item, one origin variant, BAN outside locks; no persisted donor origin/reservation. Category/need/season + four budgets, then Haversine and stable IDs; no radius gate/model/route. | FR-013, FR-014, FR-034; needs, capacity, intake_quotas, slots, donation_offers |

Photo persistence is database-only: FastAPI retains multipart file input, validates the bytes and both decoded/encoded size budgets, then atomically inserts donation_photos metadata and private.photo_contents.image_base64. Accepted base64 is canonical padded RFC 4648 text with no data-URI prefix or whitespace. The private schema has no client table access. Photo DTOs, evidence whitelists, ordinary lists and retry/audit JSON contain IDs/metadata only, never image_base64. GET content uses a restricted server capability that freshly checks owner/recipient scope, decodes the row and verifies byte count/digest; no Storage bucket or signed object URL is involved. Model adapters read the same accepted photo through the captured request scope. Upload failures roll back metadata/content together; there is no cross-service orphan object to clean up.

A first successful analysis may attach basis_analysis_id even when human facts already exist. It seeds working facts only if facts_origin=empty, captured facts_revision still matches, no active offer exists, category confidence is at least 0.80 and no evidence conflict exists. Seed and basis attachment are separate; neither can alter item/offer/booking state, a prior basis, human edits or staff decisions. Append original indicators exactly once per request. Missing/failed output produces no successful analysis row. Category mismatch is computed against the current owner's category or the recipient's frozen category.

## Offer, review and reservation routes

| Method / path | Scope | Request | Response / guards | Requirements; entities |
|---|---|---|---|---|
| POST /donations/{donationId}/offers | D | `{expected_donation_revision, association_id: UUID, need_id: UUID}` | 201 Offer; reconcile expired prior attempt, enforce one active attempt, revalidate matching, freeze facts/evidence scope; pending_review, review_deadline=now+72h, no resource hold. | FR-015, FR-033, FR-034, FR-038; donation_offers, offer_events |
| GET /donations/{donationId}/offers | D | pagination | Page<Offer>, own complete attempt history. | FR-025, FR-033; donation_offers |
| GET /offers/{offerId} | O | none | Offer; stored status plus deadline-aware effective_state; source snapshot only. | FR-016, FR-025, FR-036; donation_offers |
| GET /offers/{offerId}/events | O | pagination | Page<OfferEvent>; no history rewrite. | FR-036; offer_events |
| GET /offers/{offerId}/evidence | O | none | Evidence; only IDs frozen in evidence_snapshot, including eventual completion of already-captured requests; excludes later B-only edits/analysis. | FR-011, FR-016, FR-038; donation_photos, donation_analysis, donation_indicators, donation_edits, private.api_requests |
| GET /associations/{associationId}/offers | M | pagination, `effective_state?: OfferState`, `category?` | Page<Offer>, default pending_review; all addressed historical attempts remain queryable. | FR-016, FR-033; donation_offers |
| POST /offers/{offerId}/decision | M | `{expected_revision, decision: Decision, intake_checks?: IntakeChecks, reason?: string}` | Offer; write-once human actor/time. Approval checks live deadline, current need/storage and existence of quota/slot; requires not_medicine, eligible food when food, manual-review acknowledgement when required by analysis-v1, plus expiry-v1 checks and human reason when applicable. Holds demand+storage for 24h, freezes rate. Refusal closes attempt, leaves item ready. | FR-017, FR-034, FR-035, FR-038; donation_offers, offer_events, capacity, needs |
| POST /offers/{offerId}/withdrawal | D | `{expected_revision, reason?: string}` | Offer withdrawn, booking cancelled if present, all unreceived holds released; donation stays ready. | FR-033, FR-035, FR-036; donation_offers, bookings, offer_events |
| POST /offers/{offerId}/cancellation | M | `{expected_revision, reason: string}` | Approved Offer cancelled, booking cancelled if present; prior approved decision retained; no post-receipt cancellation. | FR-035, FR-036; donation_offers, bookings, offer_events |
| POST /associations/{associationId}/expiration-reconciliation | M | `{limit?: number}` default 50, 1–100 | `{offer_ids: UUID[], booking_ids: UUID[], has_more: boolean}`; materialize due terminal states/events under same locks; no new reservations. Deadline reads never depend on running this command. | FR-035, FR-036; donation_offers, bookings, offer_events |

At exact deadlines, the action loses its live guard. Pending review holds nothing. Approved-but-unbooked offers hold demand/storage only; booking adds dated quota/place. Every successful relevant command uses a single database reference instant after locks. A stale physically active row is materialized before a replacement insertion; partial unique indexes never depend on now(). Returning stored_state/effective_state does not persist item expiry derivatives. Late evidence can add an in-app warning but cannot automatically cancel an approval/booking.

## Booking, QR, reception and stock routes

| Method / path | Scope | Request | Response / guards | Requirements; entities |
|---|---|---|---|---|
| GET /offers/{offerId}/slots | D | pagination | Page<SlotOption>, own live approved offer; credit its own need/storage hold, future start ≤7 days, quota quantity/place and known strict date on slot local day checked. | FR-006, FR-023, FR-034; slots, intake_quotas, donation_offers |
| POST /offers/{offerId}/bookings | D | `{expected_offer_revision, slot_id: UUID}` | 201 Booking; one per offer, target FK checks, lock/recheck selected quota/place; freeze address/timezone/category/date and receivable_until=end+30m. | FR-023, FR-034, FR-035; bookings, slots, intake_quotas, offer_events |
| GET /offers/{offerId}/booking | O | none | Single<Booking>; restores the appointment for an authorized offer after reload or a lost booking response; 404 when absent/inaccessible. | FR-023, FR-025; bookings |
| GET /bookings/{bookingId} | O via booking | none | Booking; history across attempts, effective no_show at cutoff. | FR-025, FR-036; bookings |
| GET /bookings/{bookingId}/qr | D | none | QR, only live booked appointment; valid_until=receivable_until; regenerated deterministic signed data, no QR blob in ledger. | FR-023; bookings |
| POST /bookings/{bookingId}/cancellation | D or M target | `{expected_revision, reason: string}` | `{booking: Booking, offer: Offer}`; booked→cancelled, offer→cancelled, item ready; release every unreceived hold. No in-place rescheduling. | FR-035, FR-036; bookings, donation_offers, offer_events |
| GET /associations/{associationId}/arrivals | M | pagination, `date?: DateOnly` default local today | Page<{booking: Booking, offer: Offer}>, explicit local day/window/state. | FR-024; bookings, donation_offers |
| POST /associations/{associationId}/qr/resolve | M | `{payload: string}` | `{booking: Booking, offer: Offer, receivable: boolean, blocking_codes: string[]}`; signed payload + current tenant/nonce/state/window; read only, no approval/receipt. | FR-024; bookings, donation_offers |
| POST /bookings/{bookingId}/reception | M target | `{expected_revision, payload: string, confirm_full_received: true, date_checks?: DateReviewChecks, reason?: string}` | ReceptionResult; valid signature/tenant/live state and window, physical item matches eligible reviewed facts and full quantity and current expiry-v1 restriction/acknowledgements; single atomic movement + booking received + offer fulfilled + item transferred. | FR-022, FR-024, FR-036; inventory_movements, bookings, donation_offers, donations, donation_edits, offer_events |
| GET /associations/{associationId}/inventory | M | pagination, `inventory_state?: "in_stock"|"distributed"`, `category?` | Page<StockLot>, default in_stock; immutable receipt and original offer facts. | FR-022; inventory_movements, donation_offers |
| POST /inventory/{receiptId}/distributions | M receipt target | `{confirm_full_distribution: true, date_checks?: DateReviewChecks, reason?: string}` | 201 Movement; immutable receipt ID identifies lot, append full quantity once, no appointment revision or status change; release storage only; recheck current expiry-v1 restriction/acknowledgements. | FR-022, FR-034, FR-036; inventory_movements |
| GET /associations/{associationId}/expiry | M | pagination, `view: "buckets"|"distribute_first"`, `category?` | Page<StockLot>; in_stock only, read-time source-date normalization/FEFO, unknowns explicit. Counts below share scope. | FR-018, FR-019, FR-020; inventory_movements, donation_offers |
| GET /associations/{associationId}/images | M | pagination, `category?`, `indicator_key?`, `expiry_filter?` | Page<{lot: StockLot, photos: Photo[], indicators: Indicator[]}>, received undistributed stock only; scoped evidence. | FR-021; inventory_movements, donation_offers, donation_photos, donation_analysis, donation_indicators |
| GET /associations/{associationId}/expiry-counts | M | `category?` | ExpiryCounts; nine exclusive buckets, same received-undistributed scope/filter/reference. | FR-020, FR-021; inventory_movements, donation_offers |
| GET /redirect-points | U | pagination, `kind?` | Page<RedirectPoint>; no contact or transport command. | FR-012; redirect_points |

QR resolution never consumes it. Receipt authenticates again and checks current membership/tenant/nonce/state and the half-open time window. A typed signed payload is the camera fallback; no unsigned ID bypass. Terminal cancellation/no-show/receipt invalidates reception even if the signature still verifies. A delivery mismatch is cancelled before any receipt; no partial credit or late override.

New photo uploads accept JPEG/PNG/WebP files up to 4 MiB (4,194,304 bytes), with at most three photos per donation and 20 megapixels per image. The upload-size limit applies in the browser, FastAPI and the guarded database command. Existing larger photos are preserved; see the [Vercel deployment prerequisite](setup.md#1-prepare-and-apply-the-database-update).

## Pagination, errors and unavailable policy

Collections use opaque cursor keyset pagination: limit 1–100, default 25; canonical filter/sort/scope are bound into the cursor. Invalid/tampered cursors or altered filters are 422. Default sort created_at descending then ID descending; composite-PK config uses its full key ascending, chronological slots/arrivals use starts_at then ID, FEFO uses expiry-v1 group, effective date where applicable, receipt UTC time and donation UUID; unknown/NA FIFO and blocked group are explicit. Matches use distance, association ID, need ID. Revalidate every page; data may change between pages, so no frozen snapshot is promised. Expiry-dependent cursors additionally bind expiry-v1, timezone and local reference_date; a local-day change requires 422 stale_cursor and a fresh first page. Normalize/order the scoped metadata in Python before keyset pagination, not only the current page, so partial/PAO dates share the global FEFO order. Counts use the same scope/date; base64 payloads are never loaded for sorting. as_of is a response reference instant. Page meta.policy_version names the operational DEC profile; ExpiryView/expiry-counts use the separately versioned expiry-v1 policy. Computed filter/budget reads must use the same predicate across the page and counts.

| HTTP | Error codes / behavior |
|---|---|
| 401 | unauthenticated, invalid_token; no private resource details. |
| 403 | forbidden, account_disabled; verified identity lacks known operation capability. |
| 404 | not_found, including foreign resources; do not disclose tenant/item existence. |
| 409 | stale_revision, active_offer_exists, invalid_transition, deadline_elapsed, demand_exhausted, storage_exhausted, intake_quota_exhausted, slot_full, configuration_below_commitment, last_admin_required, admin_recovery_not_allowed, duplicate_identifier, already_received, already_distributed, idempotency_conflict, request_in_progress, date_context_stale, intake_date_restriction, date_clarification_required. |
| 413 / 415 | upload_too_large / unsupported_media_type, before any AI call. |
| 422 | validation_error, invalid_location, invalid_cursor, stale_cursor, invalid_qr, ineligible_item, outside_reception_window. Structured details use safe field paths/codes. |
| 429 | rate_limited; Retry-After when known; deployment limits remain to configure. |
| 500 | photo_integrity_error for an authorized photo with missing/corrupt content; no successful empty image. |
| 502 / 503 / 504 | provider_invalid_output / provider_unavailable / provider_timeout; no fabricated result. Geocoding uses geocoding_unavailable. |
| 503 | policy_required with ambiguity_ids only for remaining unresolved upload/deployment policies; not a substitute for the defined offer/member/budget mechanisms. |

Missing quota/storage/slot in matching yields exclusion/empty results with safe reasons, not a server error or unlimited capacity. A booking/approval racing a deadline is a conflict. Validation errors use this same envelope rather than leaking raw FastAPI/Pydantic/upstream exception data. No raw tokens, photos, QR strings or donor addresses in logs. No model call sets decision or decides eligibility arithmetic.

## Representative exchanges

UUIDs are illustrative; examples omit unrelated DTO fields only when explicitly labeled a projection. Dates illustrate operational timeouts, not shelf-life rules. All successful commands below require a fresh Idempotency-Key and verified bearer; GET/read-like commands do not.

**Create human facts before AI completes — POST /donations request:**

```json
{
  "facts": {
    "category": "clothes", "attributes": {"type": "coat", "size": "M"}, "quantity": "1.000", "unit": "item",
    "expiry": {"expiry_date": null, "raw_label": null, "date_type": null, "pao_months": null,
      "opened_on": null, "date_precision": "unknown", "readability": "unknown"}
  }
}
```

This marks human origin. After validated photos, publication and offering remain possible without a completed analysis. The clothes keys type=coat and size=M are valid human input under analysis-v1; other allowed human keys normalize to null.

**Submit attempt — POST /donations/10000000-0000-4000-8000-000000000001/offers request:**

```json
{"expected_donation_revision":"4","association_id":"20000000-0000-4000-8000-000000000001","need_id":"30000000-0000-4000-8000-000000000001"}
```

**Initial 201 response projection:**

```json
{"data":{"id":"40000000-0000-4000-8000-000000000001","donation_id":"10000000-0000-4000-8000-000000000001","status":"pending_review","decision":null,"review_deadline":"2026-11-04T10:00:00Z","approval_deadline":null,"revision":"1","policy_version":"mvp-domain-v1","computed":{"effective_state":"pending_review","analysis_status":"pending"}},"meta":{"request_id":"90000000-0000-4000-8000-000000000001"}}
```

**Manual approval without usable AI — POST /offers/40000000-0000-4000-8000-000000000001/decision request:**

```json
{"expected_revision":"1","decision":"approved","intake_checks":{"not_medicine":true,"analysis_unavailable_ack":true},"reason":"Photos and declared item reviewed by staff"}
```

For food, eligible_individual_food:true is additionally required. The human approval at 2026-11-01T11:00:00Z holds need/storage until 2026-11-02T11:00:00Z unless booked; it does not hold a dated intake quota yet. A later original analysis may be visible if its request was captured in the offer, without changing this decision or human facts.

**Refusal/re-offering:** another pending attempt may be refused with `{expected_revision, decision:"refused", reason}`. A subsequent POST to the same donation's offers creates a **new offer ID** at a newly selected need/association. No previous row is reset. If two submissions race, one is 409 active_offer_exists. If A's attempt is closed, later corrections and newly requested analyses for B are absent from A's evidence scope.

**Book — POST /offers/40000000-0000-4000-8000-000000000001/bookings request:**

```json
{"expected_offer_revision":"2","slot_id":"50000000-0000-4000-8000-000000000001"}
```

For a 2026-11-03 10:00–10:30 Europe/Paris slot, quota_date is 2026-11-03 and receivable_until is 2026-11-03T10:00:00Z (11:00 local). A receipt at that exact UTC instant is too late. Cancellation requires the booking revision/reason, closes the offer and releases all four reservations. To reschedule, create/review/book a fresh attempt of the same donation.

**Resolve — POST /associations/20000000-0000-4000-8000-000000000001/qr/resolve request:**

```json
{"payload":"<opaque signed dono.booking.v1 value>"}
```

The same signed string can be typed if the camera fails. The received response includes scoped booking/offer and receivable/blocking codes; it changes no state. Reception separately sends `{expected_revision, payload, confirm_full_received:true}` and returns ReceptionResult. A second independent receipt conflicts; a same-key retry returns the original receipt identity after current authorization.

**Membership grant — POST /associations/20000000-0000-4000-8000-000000000001/members request:**

```json
{"profile_id":"60000000-0000-4000-8000-000000000001","role":"assoc_staff"}
```

The target must already be an enabled account. To revoke, PATCH its membership with its revision, active:false and a reason. No email address is accepted and no message is sent. A revoked person's still-unexpired JWT confers no subsequent association access.

**Independent-budget failure, HTTP 409:**

```json
{"error":{"code":"intake_quota_exhausted","message":"The selected date cannot receive this item quantity. Refresh available dates.","request_id":"90000000-0000-4000-8000-000000000002","retryable":false,"details":[{"path":"slot_id","code":"insufficient_daily_quantity"}]}}
```

A slot can have a free appointment place while its dated intake quantity is exhausted. The domain fixture (demand 10, storage 6, storage rate 2, intake 2) makes a three-item lot ineligible independently of slot places. Matching creates no hold; approval and booking must recheck atomically.

**Late analysis response projection, HTTP 201:**

```json
{"data":{"analysis":{"id":"70000000-0000-4000-8000-000000000001","category":"shoes","provider":"openai","model":"<configured model>"},"basis_attached":true,"facts_seeded":false,"current_facts_revision":"3"},"meta":{"request_id":"90000000-0000-4000-8000-000000000003"}}
```

The actual response contains the complete Analysis, unchanged extracted evidence/indicators, input revision/photos and provenance. Human category clothes and size M remain untouched; original shoes indicators keep their category label and mismatch notice. Failure instead returns the error envelope, with no fake analysis row.

## Scope and implementation verification

Protected tests must cover every case in UC-001–UC-012/UC-015/UC-016, cross-tenant direct reads/RPC/private-photo, one active offer, two independent budget conflicts, stale-row expiry without a scheduler, cancellation/re-offering, last-quota/place contention, duplicate receipt/distribution, revocation with a stale JWT, concurrent last-admin changes and delayed analysis after human edits/offer. See [handoff](handoff.md) for order and remaining policy decisions.

This contract specifies full-lot MVP behavior. No partials, direct rescheduling, arbitrary platform reassignment, model acceptance, transport, route optimization, donation notification email or messaging routes exist. Account authentication goes directly to Supabase. Live OpenAI/real-photo evaluation and connected frontend acceptance remain release gates; document/diagram validation does not execute API or RLS behavior.

### Representative expiry-v1 read projection

For a reliable DDM date 2027-01-23, reference date 2026-10-25 is exactly 90 days earlier. This is a computed projection, not a persisted expiry_info row:

```json
{"as_of":"2026-10-25T12:00:00Z","timezone":"Europe/Paris","reference_date":"2026-10-25","effective_expiry_date":"2027-01-23","days_left":90,"expired":false,"bucket":"at_90","policy_version":"expiry-v1","unknown_reason":null,"date_basis":"exact","required_date_checks":[],"distribution_restriction":null,"fefo_group":0}
```

A source with PAO but unknown opening state instead has bucket=unknown, unknown_reason=opening_state_unknown, null effective date/days/expired and date_clarification_required; it is not a long-life estimate. Passed DDM requires ddm_passed_ack=true plus human reason at the relevant approval/reception/distribution command, while confirmed passed DLC cannot commit even with that checkbox.


## Audited false date-label correction

`DateReviewChecks` additionally accepts `date_label_correction_confirmed?: true` (and therefore `IntakeChecks` does too). This assertion is for an incorrectly detected original strict label, requires a nonempty `reason` and frozen human-confirmed source facts. Approval records the assertion, staff actor/reason and reviewed analysis IDs in the command audit context. Original AI extraction/indicators remain unchanged. It never bypasses expired/unresolved strict dates or PAO in corrected source facts. Booking may reuse the reviewed correction only with the identical completed evidence set; newly completed evidence invalidates it. Reception/distribution require a fresh assertion/reason. Invalid clarification returns `date_clarification_required`; passed strict dates return `intake_date_restriction`. Gallery indicator `source` includes `analysis_id` and original `category` alongside provider/model so category mismatch stays attributable. FR-011, FR-025, FR-038; donation_edits, donation_analysis, donation_offers, private.api_requests.
