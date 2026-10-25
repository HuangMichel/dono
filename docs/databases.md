# Dono database design

Status: **schema, RLS and guarded commands implemented** in [migrations](../supabase/migrations/); executed PostgreSQL checks and deployment limits are in [readiness](readiness.md). [AGENTS.md](../AGENTS.md) is authoritative. Read [domain-model.md](domain-model.md) for the complete working defaults and state/accounting rules, [requirements](requirements.md), [features](features.md), [architecture](architecture.md) and the [FastAPI contract](api.md).

The [interactive ERD](architecture/database-erd.html) and [source](architecture/database-erd.json) show all **21 application tables, 225 columns and 45 FK roles**, plus a managed auth.users referenced-key stub. PK/UK badges indicate participation in keys, not individual uniqueness of every component. JSON/array snapshot references are command-validated and are not falsely drawn as SQL FKs.

## Design status and working defaults

The earlier single-target donations design and DB-P01–DB-P07 were superseded by the DEC working profile in domain-model.md. All 13 original entities remain. Support tables include donation_photos, private.photo_contents, donation_edits, private.api_requests, donation_offers, offer_events, intake_quotas and membership_events. These implement the reviewed domain safeguards; no extra runtime services are introduced.

Donations contain current donor item facts only. donation_offers contains each target/need, frozen offered facts, human decision and finite leases. Cancelled/refused attempts are retained; the item can be re-offered. Bookings belong to attempts. Inventory describes physical receipt/distribution independently from all three state machines.

| Budget | Configuration | Reservation / consumption |
|---|---|---|
| Requested demand | needs.target_quantity in item units | Live approved offers hold demand; actual receipt fulfils it. Distribution does not reopen it. |
| Storage | capacity.limit_storage_units in item_slot places | Approved quantity × staff-declared frozen storage_units_per_item holds space; received undistributed stock occupies it. |
| Daily intake | intake_quotas.limit_quantity per category/local date | Booking holds items; receipt consumes that day's throughput. Distribution does not restore it. |
| Appointment places | slots.max_bookings | Booked appointments and completed receptions consume places; cancelled/no-show appointments do not reserve future places. |

No reservation or inventory balance counters are stored. The full definition of live holds, deadlines, exact release effects and deterministic matching is [normative here](domain-model.md#independent-accounting-and-matching).

## Conventions and ownership

All tables are proposed in public except private.api_requests and private.photo_contents. Enable RLS on all exposed tables and as defense in depth on private tables; grants and row policies are separate. No anonymous product access. Ordinary authenticated clients receive scoped reads only, not DML. FastAPI owns business writes through restricted atomic commands; its server credential never replaces actor/tenant checks.

Use generated UUIDs (no extension required for this small MVP), text for free-form strings, timestamptz for UTC instants, date for source calendar facts, exact numeric(12,3) quantities with an additional integral-item constraint, and integer storage places/rates. Reject NaN/infinity. Positive revisions/quantities are command-owned; capacity/quota limits may be zero. Decimal quantities/bigints serialize as strings. No implicit kg/volume conversion or model arithmetic.

FK actions are ON DELETE RESTRICT / ON UPDATE RESTRICT until the retention policy is designed. No product hard deletes. Original analyses/indicators, accepted photo metadata/content and audit/movement rows are append-only. Referenced private analysis-request context must survive ordinary retry-cache cleanup. This is evidence integrity, not authorization for indefinite personal-data retention.

Operational lease deadlines and snapshotted event/source facts are persisted; product expiry derivatives are not. Store no item days_left, expired, bucket, FEFO rank, effective PAO-derived date or serialized response containing those computed values. A policy version identifies the proposed working defaults; changing future defaults does not extend existing deadlines.

## Enumerated types

Closed vocabularies use **named PostgreSQL ENUM objects**, referenced by table columns; the dictionary repeats their labels at every affected column. They are implemented by CREATE TYPE statements in the schema migration. Shared category/unit types prevent mismatched table contracts; Python/Pydantic enums and frontend wire unions must agree. Enum order never encodes matching rank or allowed lifecycle transitions. [PostgreSQL enums](https://www.postgresql.org/docs/current/datatype-enum.html)

| SQL enum type | Labels |
|---|---|
| `platform_role` | `donor`, `platform_admin` |
| `assoc_role` | `assoc_admin`, `assoc_staff` |
| `association_status` | `pending`, `approved` |
| `membership_action` | `bootstrap`, `activate`, `grant`, `role_change`, `revoke`, `transfer`, `recovery` |
| `redirect_kind` | `pharmacy`, `textile_bin`, `repair_cafe` |
| `donation_category` | `clothes`, `shoes`, `food`, `para`, `furniture` |
| `quantity_unit` | `item` |
| `storage_unit` | `item_slot` |
| `need_season` | `spring`, `summer`, `autumn`, `winter` |
| `donation_state` | `draft`, `ready`, `withdrawn`, `transferred` |
| `facts_origin` | `empty`, `human`, `ai_seeded` |
| `offer_state` | `pending_review`, `approved`, `refused`, `withdrawn`, `cancelled`, `expired`, `fulfilled` |
| `donation_decision` | `approved`, `refused` |
| `booking_state` | `booked`, `cancelled`, `no_show`, `received` |
| `offer_event_reason` | `submitted`, `human_approved`, `human_refused`, `booked`, `donor_withdrawal`, `staff_cancellation`, `booking_cancelled`, `review_timeout`, `booking_timeout`, `no_show`, `received` |
| `donation_change_kind` | `created`, `facts_edited`, `published`, `withdrawn`, `restored`, `transferred`, `analysis_seeded` |
| `photo_kind` | `item`, `label` |
| `analysis_provider` | `openai`, `jev`, `hybrid` |
| `indicator_provider` | `openai`, `jev` |
| `indicator_level` | `low`, `medium`, `high` |
| `expiry_date_type` | `DLC`, `DDM`, `expiry`, `PAO` |
| `date_precision` | `day`, `month`, `year`, `unknown` |
| `date_readability` | `readable`, `unreadable`, `unknown` |
| `movement_kind` | `receipt`, `distribution` |
| `request_state` | `in_progress`, `completed`, `failed` |

Unit/storage/season labels are the declared working profile, not unbounded text. Free-form model IDs, names, addresses, timezones, paths, MIME strings and schema-versioned indicator keys retain text with validators.

## Data dictionary

Every FK has a leading-key supporting index, including inactive and non-NULL nullable references. PK/UK indexes are implied by constraints; do not create duplicate plain indexes. All actor, snapshot, state and version fields are command-owned.

### profiles

Application identity; platform capability is provisioning-only. **Ownership:** Account owner; protected fields are operator-only. **Trace:** FR-001, FR-037.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + FK → auth.users.id | Auth subject | Same identifier as managed auth.users.id; never caller-selected. |
| `display_name` | `text` | yes | — | NULL | Optional own display name; no automatic donor identity disclosure to staff. |
| `platform_role` | `platform_role` | no | — | donor | donor or platform_admin; protected from self-update. Allowed labels: `donor`, `platform_admin`. |
| `revision` | `bigint` | no | — | 1 | Positive write version, incremented by commands. |
| `created_at` | `timestamptz` | no | — | now() | Creation instant. |
| `updated_at` | `timestamptz` | no | — | now() | Last profile edit. |
| `disabled_at` | `timestamptz` | yes | — | trusted provisioning | Protected account-disable timestamp; disabled subjects have no business rights even with an unexpired JWT. |

**Constraints / guards:** PK/FK(id) → auth.users(id); revision > 0. disabled_at/platform_role cannot be set by profile PATCH.

**Indexes:** PK(id) covers Auth FK.

### associations

Registration and intake settings. **Ownership:** Applicant until approval; then active members. Platform reads approval records only. **Trace:** FR-002, FR-006, FR-037.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Association identifier. |
| `name` | `text` | no | — | none | Nonempty display name. |
| `registered_by` | `uuid` | no | FK → profiles.id | verified actor | Verified applicant; creates the one pending initial-admin membership atomically. |
| `rna` | `text` | yes | — | NULL | Normalized RNA text; at least one RNA/SIRET required, syntactically validated and manually verified (DEC-011). |
| `siret` | `text` | yes | — | NULL | Normalized SIRET text preserving leading zeros; at least one RNA/SIRET, unique and manually verified (DEC-011). |
| `approval_status` | `association_status` | no | — | pending | pending or approved; association approval is not a donation decision. Allowed labels: `pending`, `approved`. |
| `approved_by` | `uuid` | yes | FK → profiles.id | NULL | Platform actor only. |
| `approved_at` | `timestamptz` | yes | — | NULL | Approval instant, paired with approved_by. |
| `display_address` | `text` | yes | — | NULL | Intake address, donor disclosure controlled by projection. |
| `latitude` | `double precision` | yes | — | NULL | Verified geocoding coordinate; no fabricated fallback. |
| `longitude` | `double precision` | yes | — | NULL | Verified geocoding coordinate. |
| `timezone` | `text` | no | — | Europe/Paris working default | Validated association IANA zone. Freeze after any slot exists in MVP; operational deadlines use UTC instants. |
| `opening_hours` | `jsonb` | no | — | [] | Proposed weekly intervals: weekday, start_local, end_local; slot commands validate against them. |
| `revision` | `bigint` | no | — | 1 | Positive command version. |
| `created_at` | `timestamptz` | no | — | now() | Registration instant. |
| `updated_at` | `timestamptz` | no | — | now() | Last configuration/approval change. |

**Constraints / guards:** PK(id). At least one syntactically valid normalized RNA/SIRET. Partial UNIQUE(rna) / UNIQUE(siret) where non-NULL: one intake site per legal entity in MVP. Approval actor/time absent while pending, present while approved. On approval activate the registered applicant atomically. Coordinate pair valid/finite; IANA timezone required. Address/hours changes reject while live bookings exist; timezone cannot change after any slot exists.

**Indexes:** (registered_by,created_at DESC,id DESC); (approved_by) WHERE approved_by IS NOT NULL; (approval_status,created_at DESC,id DESC); partial unique RNA and SIRET indexes.

### association_members

Current per-tenant permissions. **Ownership:** Own row; active admins read own roster. **Trace:** FR-001, FR-037.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `association_id` | `uuid` | no | PK + FK → associations.id | none | Association in composite PK. |
| `profile_id` | `uuid` | no | PK + FK → profiles.id | none | Member in composite PK. |
| `role` | `assoc_role` | no | — | none | assoc_admin or assoc_staff. Allowed labels: `assoc_admin`, `assoc_staff`. |
| `active` | `boolean` | no | — | false at registration; guarded activation/grant | Pending applicant membership is inactive. Current active membership and approved association are required for personnel permissions. |
| `created_at` | `timestamptz` | no | — | now() | Membership provisioned at. |
| `revision` | `bigint` | no | — | 1 | Positive membership version. |
| `updated_at` | `timestamptz` | no | — | now() | Last guarded role/active change. |

**Constraints / guards:** PK(association_id,profile_id); revision > 0. Pending applicant role is assoc_admin with active=false. Approved association commands preserve at least one active enabled admin. Revocation changes active, never deletes the row.

**Indexes:** PK(association_id,profile_id); (profile_id,association_id) WHERE active; (profile_id) including inactive rows.

### membership_events

Append-only grant/revoke/transfer history. **Ownership:** Own affected history or current active association admin. **Trace:** FR-037; NFR-005.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Immutable membership audit event. |
| `association_id` | `uuid` | no | FK → associations.id | command | Affected tenant. |
| `profile_id` | `uuid` | no | FK → profiles.id | command | Affected existing account. |
| `action` | `membership_action` | no | — | command | Guarded provisioning or membership operation. Allowed labels: `bootstrap`, `activate`, `grant`, `role_change`, `revoke`, `transfer`, `recovery`. |
| `role_before` | `assoc_role` | yes | — | command | NULL only if the membership did not exist. Allowed labels: `assoc_admin`, `assoc_staff`. |
| `role_after` | `assoc_role` | no | — | command | Resulting role; revoked rows remain with active=false. Allowed labels: `assoc_admin`, `assoc_staff`. |
| `active_before` | `boolean` | no | — | command | Prior activity, false for creation. |
| `active_after` | `boolean` | no | — | command | Resulting activity. |
| `actor_id` | `uuid` | no | FK → profiles.id | verified actor | Applicant for bootstrap; platform reviewer for activation/recovery; own admin for management. |
| `reason` | `text` | yes | — | command | Required for revocation/recovery; no credentials or personal evidence dumps. |
| `created_at` | `timestamptz` | no | — | now() | Audit recorded at. |

**Constraints / guards:** PK(id). Composite FK(association_id,profile_id) → association_members. actor_id is command-derived. Creation, activation, transfer and recovery are audited; no product UPDATE/DELETE.

**Indexes:** (association_id,created_at DESC,id DESC); (profile_id,created_at DESC,id DESC); (actor_id).

### redirect_points

Shared alternatives, not transport destinations. **Ownership:** Authenticated active listing. **Trace:** FR-012.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Reference identifier. |
| `kind` | `redirect_kind` | no | — | none | pharmacy, textile_bin or repair_cafe. Allowed labels: `pharmacy`, `textile_bin`, `repair_cafe`. |
| `name` | `text` | no | — | none | Destination name. |
| `address` | `text` | no | — | none | Human-readable location. |
| `latitude` | `double precision` | yes | — | NULL | Optional known coordinate. |
| `longitude` | `double precision` | yes | — | NULL | Optional known coordinate. |
| `description` | `text` | yes | — | NULL | Informational guidance, not a message channel. |
| `active` | `boolean` | no | — | true | Visible shared listing. |

**Constraints / guards:** PK(id); supported kind, nonempty name/address and valid optional coordinate pair. Seed-owned; no new management UI.

**Indexes:** (kind,id) WHERE active.

### capacity

Physical storage budget, independent of demand and throughput. **Ownership:** Association members read; assoc_admin configures. **Trace:** FR-005, FR-014, FR-034.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `association_id` | `uuid` | no | PK + FK → associations.id | command | Tenant/category storage ceiling. |
| `category` | `donation_category` | no | PK | command | One row per category. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `storage_unit` | `storage_unit` | no | — | staff confirmation | Administrative storage place, independent of demanded item count. Allowed labels: `item_slot`. |
| `limit_storage_units` | `integer` | no | — | staff input | Nonnegative configured storage ceiling; no used/reserved counter. |
| `revision` | `bigint` | no | — | 1 | Positive write version. |
| `updated_at` | `timestamptz` | no | — | now() | Last configuration change. |

**Constraints / guards:** PK(association_id,category); limit_storage_units >= 0. Cannot reduce below current live storage holds + received undistributed storage. No reserved/available counter.

**Indexes:** PK(association_id,category).

### needs

Human-confirmed item demand and staff storage estimate. **Ownership:** Association members read; assoc_admin configures. **Trace:** FR-003, FR-004, FR-014, FR-034.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Need identifier. |
| `association_id` | `uuid` | no | FK + UK → associations.id | none | Owner association. |
| `category` | `donation_category` | no | — | none | Supported category. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `attributes` | `jsonb` | no | — | {} | Validated matching attributes, e.g. size/product/size class. |
| `seasons` | `need_season[]` | no | — | explicit staff input | Empty array explicitly means no current-season restriction; otherwise use the association calendar-season rule. Allowed labels: `spring`, `summer`, `autumn`, `winter` (elements). |
| `target_quantity` | `numeric(12,3)` | no | — | none | Positive human-confirmed target. |
| `unit` | `quantity_unit` | no | — | none | Requested item-count unit, not a physical storage unit. Allowed labels: `item`. |
| `active` | `boolean` | no | — | true | Whether new matches can use this need. |
| `source_text` | `text` | yes | — | NULL | Optional original free-text need; staff-only scope. |
| `created_by` | `uuid` | no | FK → profiles.id | verified actor | Authorized confirming staff member. |
| `revision` | `bigint` | no | — | 1 | Positive write version. |
| `created_at` | `timestamptz` | no | — | now() | Confirmed need created at. |
| `updated_at` | `timestamptz` | no | — | now() | Last confirmed change. |
| `storage_units_per_item` | `integer` | no | — | staff input | Positive staff-declared storage cost per item. Code multiplies; the model never estimates capacity. |

**Constraints / guards:** PK(id), UNIQUE(id,association_id). Positive finite integral target; storage_units_per_item > 0. Cannot reduce demand below live holds + received fulfilled quantity. Category/unit immutable while commitments exist; rate changes affect future approvals only. Empty seasons array is explicit unrestricted current-season policy.

**Indexes:** UNIQUE(id,association_id); (association_id,category,id) WHERE active; (association_id,created_at DESC,id DESC); (created_by).

### intake_quotas

Dated category throughput budget. **Ownership:** Association members read; assoc_admin configures. **Trace:** FR-034.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `association_id` | `uuid` | no | PK + FK → associations.id | command | Tenant intake budget. |
| `category` | `donation_category` | no | PK | command | Eligible category. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `service_date` | `date` | no | PK | staff input | Association-local intake day, separate from product expiry. |
| `unit` | `quantity_unit` | no | — | item | Throughput measured in donated items. Allowed labels: `item`. |
| `limit_quantity` | `numeric(12,3)` | no | — | staff input | Nonnegative integral daily intake ceiling. |
| `revision` | `bigint` | no | — | 1 | Positive configuration version. |
| `updated_at` | `timestamptz` | no | — | now() | Last quota edit. |

**Constraints / guards:** PK(association_id,category,service_date). Nonnegative integral limit_quantity. Cannot reduce below live booked + already received quantities for this date. Missing row is not unlimited intake.

**Indexes:** PK(association_id,category,service_date).

### donations

Reusable item/source facts; no target or decision. **Ownership:** Raw current row is donor-only; staff use offer snapshots. **Trace:** FR-010, FR-011, FR-033, FR-036, FR-038.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Donation aggregate identifier. |
| `donor_id` | `uuid` | no | FK → profiles.id | verified actor | Immutable donor ownership. |
| `category` | `donation_category` | yes | — | NULL | Current working category; NULL allowed before extraction/correction. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `attributes` | `jsonb` | no | — | {} | Current validated attributes, separate from immutable extracted JSON. |
| `quantity` | `numeric(12,3)` | yes | — | NULL | Current positive integral lot quantity, validated before publish/offer. |
| `unit` | `quantity_unit` | yes | — | NULL | Required before offering; no implicit conversion. Allowed labels: `item`. |
| `basis_analysis_id` | `uuid` | yes | FK → donation_analysis.id | NULL | First successful comparison basis, optional. Attaching it never requires seeding or overwriting human facts. |
| `status` | `donation_state` | no | — | draft | Item disposition only. ready does not mean there is no active offer; can_offer is computed. Allowed labels: `draft`, `ready`, `withdrawn`, `transferred`. |
| `revision` | `bigint` | no | — | 1 | Positive aggregate version, independent of offer/booking revisions. |
| `created_at` | `timestamptz` | no | — | now() | Draft created at. |
| `updated_at` | `timestamptz` | no | — | now() | Last aggregate transition. |
| `facts_revision` | `bigint` | no | — | 1 | Changes only when current source facts or photos change; captured by analysis/offer snapshots. |
| `facts_origin` | `facts_origin` | no | — | empty or human on creation | Any supplied human facts mark human; first AI may seed only an untouched empty working set. Allowed labels: `empty`, `human`, `ai_seeded`. |

**Constraints / guards:** PK(id). Same-item composite FK(basis_analysis_id,id) → donation_analysis(id,donation_id). Positive revisions; nullable early facts, but publish requires category, positive integral quantity, item unit, category-valid facts and validated photos. No active offer while withdrawn/transferred. No donation-wide booking uniqueness or decision field.

**Indexes:** (donor_id,created_at DESC,id DESC); (basis_analysis_id) WHERE basis_analysis_id IS NOT NULL.

### donation_offers

One targeted attempt with frozen facts and bounded validity. **Ownership:** Owner via donation, or active member of this offer association. **Trace:** FR-015, FR-017, FR-033–FR-036.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | One immutable target attempt; never reuse this ID for a re-offer. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | command | Reusable donor-owned item. |
| `association_id` | `uuid` | no | FK + UK → associations.id | command | Receiving association for this attempt. |
| `need_id` | `uuid` | no | FK → needs.id | command | Need in the same receiving association. |
| `category` | `donation_category` | no | — | command | Frozen working category, used for scoped counters/indexes. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `quantity` | `numeric(12,3)` | no | — | command | Frozen positive integral lot quantity. |
| `unit` | `quantity_unit` | no | — | item | Frozen demand/intake item unit. Allowed labels: `item`. |
| `facts_revision` | `bigint` | no | — | command | Current item source revision captured at submission. |
| `facts_snapshot` | `jsonb` | no | — | server snapshot | Validated category/attributes/quantity/unit and source expiry facts only; never derived expiry. |
| `evidence_snapshot` | `jsonb` | no | — | server snapshot | Photo ID/digest pairs, allowed analysis-request IDs and edit IDs known at submission. Validated references, not SQL FKs inside JSON. |
| `basis_analysis_id` | `uuid` | yes | FK → donation_analysis.id | command | Optional submitted comparison basis, same donation. A later run does not replace this snapshot. |
| `status` | `offer_state` | no | — | pending_review | Attempt state, independent of item, booking and stock states. Allowed labels: `pending_review`, `approved`, `refused`, `withdrawn`, `cancelled`, `expired`, `fulfilled`. |
| `decision` | `donation_decision` | yes | — | NULL | Only target personnel set approved/refused; remains unchanged if an approved attempt later expires/cancels. Allowed labels: `approved`, `refused`. |
| `decided_by` | `uuid` | yes | FK → profiles.id | NULL | Original human decision actor. |
| `decided_at` | `timestamptz` | yes | — | NULL | Original human decision time. |
| `intake_checks` | `jsonb` | yes | — | NULL | Closed human assertions: not_medicine, eligible_individual_food and conditional analysis_unavailable_ack/date_review_ack/ddm_passed_ack; no computed expiry. |
| `storage_units_per_item` | `integer` | yes | — | current need at approval | Positive staff-configured storage rate frozen on human approval; code computes reserved units. |
| `review_deadline` | `timestamptz` | no | — | created_at + 72 hours | Immutable operational lease deadline, not product expiry. |
| `approval_deadline` | `timestamptz` | yes | — | decided_at + 24 hours | Latest time to create the one booking; booked holds instead end at booking.receivable_until. |
| `closed_at` | `timestamptz` | yes | — | NULL | Terminal effective instant; remains NULL while pending/approved. |
| `revision` | `bigint` | no | — | 1 | Positive attempt version; every attempt event advances it. |
| `created_at` | `timestamptz` | no | — | now() | Submission instant. |
| `updated_at` | `timestamptz` | no | — | now() | Last guarded attempt change. |
| `policy_version` | `text` | no | — | mvp-domain-v1 | Working deadline/accounting policy captured for this attempt. |

**Constraints / guards:** PK(id); UNIQUE(id,donation_id,association_id), UNIQUE(id,association_id). Composite FK(need_id,association_id) → needs; same-item basis FK. Partial UNIQUE(donation_id) WHERE status IN (pending_review,approved); never use now() in this index predicate. Commands validate frozen category/quantity/unit equal facts_snapshot and match the selected need category/unit. Snapshot references validated by commands. decision/actor/time written once by personnel only. approved/fulfilled require approved decision and positive frozen storage rate. refused requires refused decision. Later withdrawn/cancelled/expired retains any prior human decision. review_deadline > created_at; approval_deadline set only on approval. closed_at required exactly for terminal states.

**Indexes:** UNIQUE(id,donation_id,association_id); UNIQUE(id,association_id); partial UNIQUE(donation_id) for pending_review/approved; (donation_id,created_at DESC,id DESC); (association_id,status,created_at DESC,id DESC); (need_id,status); (association_id,category,status); (review_deadline) WHERE status=pending_review; (approval_deadline) WHERE status=approved; (basis_analysis_id) WHERE basis_analysis_id IS NOT NULL; (decided_by) WHERE decided_by IS NOT NULL.

### offer_events

Append-only attempt transitions including deterministic expiry. **Ownership:** Inherits its offer. **Trace:** FR-033, FR-035, FR-036.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Immutable attempt history event. |
| `offer_id` | `uuid` | no | FK + UK → donation_offers.id | command | Attempt whose history this event belongs to. |
| `association_id` | `uuid` | no | FK → associations.id | command | Same association as offer. |
| `offer_revision` | `bigint` | no | UK | command | Resulting attempt revision; unique within its history. |
| `from_state` | `offer_state` | yes | — | command | NULL only for initial submission. Allowed labels: `pending_review`, `approved`, `refused`, `withdrawn`, `cancelled`, `expired`, `fulfilled`. |
| `to_state` | `offer_state` | no | — | command | Resulting state; booked child event can retain approved. Allowed labels: `pending_review`, `approved`, `refused`, `withdrawn`, `cancelled`, `expired`, `fulfilled`. |
| `reason` | `offer_event_reason` | no | — | command | Machine-readable operation/cause; expiry is operational, never an AI refusal. Allowed labels: `submitted`, `human_approved`, `human_refused`, `booked`, `donor_withdrawal`, `staff_cancellation`, `booking_cancelled`, `review_timeout`, `booking_timeout`, `no_show`, `received`. |
| `note` | `text` | yes | — | command | Required human refusal/cancellation explanation, optional otherwise. |
| `actor_id` | `uuid` | yes | FK → profiles.id | verified human or NULL system | NULL for deterministic expiration/no-show events only. |
| `effective_at` | `timestamptz` | no | — | command clock or cutoff | When the transition took effect, including an elapsed lease deadline. |
| `recorded_at` | `timestamptz` | no | — | now() | When reconciliation recorded it; may follow effective_at. |

**Constraints / guards:** PK(id); UNIQUE(offer_id,offer_revision); composite FK(offer_id,association_id) → donation_offers. Effective deadline event may be recorded later. Human refusal/cancellation requires note. NULL actor only for timed expiration/no-show. No product UPDATE/DELETE.

**Indexes:** UNIQUE(offer_id,offer_revision); (association_id,recorded_at DESC,id DESC); (actor_id) WHERE actor_id IS NOT NULL.

### donation_photos

Immutable validated image metadata; content lives in private.photo_contents. **Ownership:** Owner or explicitly referenced photo in a readable offer snapshot. **Trace:** FR-007, FR-009.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Photo identifier used by analysis requests. |
| `donation_id` | `uuid` | no | FK → donations.id | none | Owning item. |
| `mime_type` | `text` | no | — | validated type | Validated content type, not blindly copied from header. |
| `size_bytes` | `bigint` | no | — | validated size | Positive validated byte count. |
| `sha256` | `text` | no | — | computed digest | 64 lowercase hex characters; binds evidence to bytes. |
| `kind` | `photo_kind` | no | — | none | item or label. Allowed labels: `item`, `label`. |
| `uploaded_by` | `uuid` | no | FK → profiles.id | verified donor | Uploader must own the donation. |
| `created_at` | `timestamptz` | no | — | now() | Validated asset metadata created at. |

**Constraints / guards:** PK(id); positive decoded size; 64-hex SHA-256 of accepted decoded bytes. A validated write command inserts metadata and exactly one private.photo_contents row atomically. No byte replacement/upsert; uploads change facts_revision and are blocked by an effective live offer.

**Indexes:** PK(id); (donation_id,created_at,id); (uploaded_by).

### private.photo_contents

Immutable base64 photo payload, isolated from ordinary metadata/list reads. **Ownership:** Same owner/offer-evidence scope as its donation_photos row, enforced by the authenticated server content capability. **Trace:** FR-007, FR-016; NFR-001, NFR-003.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `photo_id` | `uuid` | no | PK + FK → donation_photos.id | validated upload command | Exactly one retained payload per accepted photo; same immutable photo ID used by analysis/snapshots. |
| `image_base64` | `text` | no | — | server encoding of validated bytes | Nonempty canonical standard RFC 4648 base64, padded when needed; no data-URI prefix, whitespace or line wrapping. |

**Constraints / guards:** PK/FK(photo_id), ON DELETE/UPDATE RESTRICT. Metadata and payload are accepted together in one guarded transaction; no standalone metadata or content insertion path. At the FK level a metadata row has zero-or-one payload; the upload command requires exactly one for every accepted photo. Validate canonical alphabet/padding and length divisible by four; decode/re-encode equality, decoded byte count and SHA-256 must match metadata. Cross-table comparisons are command guards, not a misleading cross-row CHECK. Check decoded limit B and encoded limit 4 × ceil(B/3) before committing; actual B/count/formats remain AMB-003. Re-encoding for integrity must normalize PostgreSQL encode() line feeds before comparing to canonical input. No product UPDATE/DELETE, raw bytes/base64 in history/retry logs, or index on the payload.

**Indexes:** PK(photo_id), which also supports its FK. No unique hash/payload index; the same legitimate photo may occur on different items without exposing a global deduplication lookup.

### donation_analysis

Immutable successful original evidence, independent from seed eligibility. **Ownership:** Owner or request_id whitelisted by a readable offer evidence snapshot. **Trace:** FR-008, FR-011, FR-038.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Analysis run identifier. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | none | Item analyzed. |
| `provider` | `analysis_provider` | no | — | server config | openai, jev or hybrid; never selected by an untrusted result. Allowed labels: `openai`, `jev`, `hybrid`. |
| `model` | `text` | no | — | server config | Actual model identifier from the selected provider configuration. |
| `category` | `donation_category` | no | — | validated output | Original AI category, never relabeled after a human override. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `extracted` | `jsonb` | no | — | validated output | Immutable analysis-v1 closed extracted object: schema_version, five-way classification, category attributes and source dates. No computed expiry/opening date. |
| `confidence` | `numeric` | no | — | validated output | Finite original selected-category probability in [0,1], equal to its classification entry; no fixed-scale rounding or suitability meaning. |
| `input_photos` | `jsonb` | no | — | server snapshot | Array of photo_id + sha256 pairs, validated as belonging to this item; historical snapshot, not SQL FKs inside JSON. |
| `input_facts_revision` | `bigint` | no | — | captured revision | Immutable source revision captured at request start; a late run may describe an older working category. |
| `provenance` | `jsonb` | no | — | server metadata | Schema/indicator-level policy version analysis-v1 and component provider/model attribution; no credentials or provider-private payloads. |
| `created_at` | `timestamptz` | no | — | now() | Original run persisted at. |
| `request_id` | `uuid` | no | FK + UK → private.api_requests.id | trusted registered request | One successful original result per durable analysis request. Scoped by immutable request context. |

**Constraints / guards:** PK(id), UNIQUE(id,donation_id), UNIQUE(request_id). Result+indicators append atomically, server-only. Same item/photo request context checked. Finite [0,1] confidence with no fixed-scale rounding. Late result may attach a missing comparison basis without changing facts. No product UPDATE/DELETE.

**Indexes:** UNIQUE(id,donation_id); UNIQUE(request_id); (donation_id,created_at DESC,id DESC).

### donation_indicators

Immutable original values and component attribution. **Ownership:** Inherits its analysis. **Trace:** BR-001; FR-009, FR-011, FR-038.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `analysis_id` | `uuid` | no | PK + FK → donation_analysis.id | none | Parent run in composite PK. |
| `key` | `text` | no | PK | validated output | Schema-defined indicator key; duplicate keys rejected. |
| `value` | `text` | yes | — | NULL | Optional extracted/observed indicator value. |
| `probability` | `numeric` | yes | — | NULL | Optional finite estimate in [0,1], not a decision. |
| `level` | `indicator_level` | yes | — | NULL | low, medium or high when present. Allowed labels: `low`, `medium`, `high`. |
| `source_provider` | `indicator_provider` | no | — | server attribution | openai or jev component that supplied this indicator. Allowed labels: `openai`, `jev`. |
| `source_model` | `text` | no | — | server attribution | Actual component model identifier. |

**Constraints / guards:** PK(analysis_id,key); optional probability finite [0,1], no fixed-scale rounding. Exactly the common + selected-category indicator keys in analysis-v1, no duplicates. Python assigns level from probability at insertion; null probability has null level and remains an unknown key-only/observation row. Preserve original p/value and policy attribution unchanged. No product UPDATE/DELETE.

**Indexes:** PK(analysis_id,key).

### expiry_info

Current donor source dates, never derived expiry. **Ownership:** Raw row donor-only; staff expiry comes from frozen offer facts. **Trace:** FR-018–FR-020.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `donation_id` | `uuid` | no | PK + FK → donations.id | none | Current donor source dates; staff use the offered snapshot instead of future edited values. |
| `expiry_date` | `date` | yes | — | NULL | Exact printed/confirmed calendar date only; not a derived PAO date. |
| `date_type` | `expiry_date_type` | yes | — | NULL | DLC, DDM, expiry or PAO. Allowed labels: `DLC`, `DDM`, `expiry`, `PAO`. |
| `pao_months` | `smallint` | yes | — | NULL | Positive printed/confirmed PAO months. |
| `date_precision` | `date_precision` | no | — | unknown | day, month, year or unknown; partial dates are not fabricated as exact dates. Allowed labels: `day`, `month`, `year`, `unknown`. |
| `raw_label` | `text` | yes | — | NULL | Source label text when readable, including a partial date. |
| `readability` | `date_readability` | no | — | unknown | readable, unreadable or unknown; NULL date does not imply expired. Allowed labels: `readable`, `unreadable`, `unknown`. |
| `opened_on` | `date` | yes | — | NULL | Human-only ISO opening date for confirmed-opened para PAO; never inferred from upload/current time. Validate under expiry-v1. |
| `edited_by` | `uuid` | yes | FK → profiles.id | NULL | Human who last corrected date facts; NULL for original seeding. |
| `updated_at` | `timestamptz` | no | — | now() | Last source-fact update. |

**Constraints / guards:** PK/FK(donation_id). Exact date only with day precision; pao_months NULL or integer 1–120 under analysis-v1; opened_on human-only. Category attributes carry para opening_state. Partial/ambiguous raw source rules are expiry-v1; normalized month-end/PAO dates are never written. No days_left, expired, bucket, PAO-derived deadline or FEFO rank. Read-time normalization, unknowns, buckets, strict-date guards and FEFO use expiry-v1.

**Indexes:** PK(donation_id); (edited_by) WHERE edited_by IS NOT NULL; (expiry_date,donation_id) WHERE expiry_date IS NOT NULL.

### donation_edits

Append-only item facts/disposition journal. **Ownership:** Owner; staff only edit IDs explicitly captured by their offer. **Trace:** FR-010, FR-011, FR-036, FR-038.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Correction event identifier. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | none | Corrected item. |
| `actor_id` | `uuid` | yes | FK → profiles.id | verified actor | Verified owner or receiving staff for transfer; NULL only for analysis_seeded. |
| `basis_analysis_id` | `uuid` | yes | FK → donation_analysis.id | NULL | AI run being compared at this correction; same-item composite guard. |
| `base_revision` | `bigint` | no | UK | expected revision | Prior donation aggregate revision; zero for creation; nonnegative and unique per donation. |
| `before_facts` | `jsonb` | no | — | server snapshot | Full prior working category/attributes/quantity/unit/expiry source facts. |
| `after_facts` | `jsonb` | no | — | server snapshot | Full resulting working facts; no original indicator mutation. |
| `created_at` | `timestamptz` | no | — | now() | Human correction recorded at. |
| `change_kind` | `donation_change_kind` | no | — | command | Item facts/disposition event; originals remain immutable. Allowed labels: `created`, `facts_edited`, `published`, `withdrawn`, `restored`, `transferred`, `analysis_seeded`. |
| `from_state` | `donation_state` | yes | — | command | NULL only on item creation. Allowed labels: `draft`, `ready`, `withdrawn`, `transferred`. |
| `to_state` | `donation_state` | no | — | command | Resulting item disposition. Allowed labels: `draft`, `ready`, `withdrawn`, `transferred`. |

**Constraints / guards:** PK(id); UNIQUE(donation_id,base_revision), base_revision >= 0. Same-item basis FK. Before/after snapshots contain source facts only. NULL actor only for analysis_seeded; initial created event has base_revision=0 and NULL from_state. Item publish/withdraw/restore/transfer events preserve disposition history.

**Indexes:** UNIQUE(donation_id,base_revision); (donation_id,created_at DESC,id DESC); (actor_id) WHERE actor_id IS NOT NULL; (basis_analysis_id) WHERE basis_analysis_id IS NOT NULL.

### slots

One association-local-day appointment interval. **Ownership:** Members read; assoc_admin configures. **Trace:** FR-006, FR-023.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Slot identifier. |
| `association_id` | `uuid` | no | FK + UK → associations.id | none | Target association. |
| `starts_at` | `timestamptz` | no | — | none | Absolute start instant; display in agreed association zone. |
| `ends_at` | `timestamptz` | no | — | none | Absolute end instant after start. |
| `max_bookings` | `integer` | no | — | none | Positive ceiling of drop-off bookings, distinct from category quantity capacity. |
| `active` | `boolean` | no | — | true | Can accept new bookings; not permission to invalidate existing bookings. |
| `revision` | `bigint` | no | — | 1 | Positive write version. |
| `created_at` | `timestamptz` | no | — | now() | Slot configured at. |
| `updated_at` | `timestamptz` | no | — | now() | Last configuration change. |

**Constraints / guards:** PK(id); UNIQUE(id,association_id). starts_at < ends_at, max_bookings > 0; contained in configured hours and one local date. No active overlapping slots per association, checked under mutex. Time changes disallowed with any booking history; active=false stops new bookings, does not invalidate an existing appointment. Limit cannot fall below live booked + received count.

**Indexes:** UNIQUE(id,association_id); (association_id,starts_at,id).

### bookings

One appointment per offer; historical item attempts may have many. **Ownership:** Donation owner or target member via offer. **Trace:** FR-023–FR-025, FR-035, FR-036.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Booking identifier. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | none | Item identity for scoped joins; NOT unique across historical attempts. |
| `association_id` | `uuid` | no | FK + UK → associations.id | none | Must match both offer and slot. |
| `slot_id` | `uuid` | no | FK → slots.id | none | Chosen target-association slot. |
| `qr_nonce` | `uuid` | no | — | generated UUID | Reference/version nonce, not a bearer secret; signing key stays server-only. |
| `created_at` | `timestamptz` | no | — | now() | Booking committed at. |
| `offer_id` | `uuid` | no | FK + UK → donation_offers.id | command | One booking per attempt; a new attempt can have a new booking. |
| `category` | `donation_category` | no | — | command | Frozen category for same-day quota FK. Allowed labels: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `quota_date` | `date` | no | — | slot local date | Source intake day; matches the selected quota row. |
| `status` | `booking_state` | no | — | booked | Appointment state only. Allowed labels: `booked`, `cancelled`, `no_show`, `received`. |
| `receivable_until` | `timestamptz` | no | — | slot end + 30 minutes | Hold/QR deadline; receipt interval is [slot start, receivable_until). |
| `dropoff_address` | `text` | no | — | association snapshot | Nonempty intake address preserved for this appointment. |
| `timezone` | `text` | no | — | association snapshot | IANA zone used when booking was created. |
| `closed_at` | `timestamptz` | yes | — | NULL | Terminal cancellation/no-show/reception instant. |
| `closed_by` | `uuid` | yes | FK → profiles.id | NULL | Human cancelling/receiving; NULL for system no-show. |
| `close_reason` | `text` | yes | — | NULL | Required for cancellation; canonical no_show/received for the other terminal outcomes. |
| `revision` | `bigint` | no | — | 1 | Positive appointment version. |
| `policy_version` | `text` | no | — | mvp-domain-v1 | Captured booking/grace policy; later config cannot extend this QR. |

**Constraints / guards:** PK(id), UNIQUE(offer_id), UNIQUE(id,offer_id,donation_id,association_id). Composite FK(offer_id,donation_id,association_id) → donation_offers; (slot_id,association_id) → slots; (association_id,category,quota_date) → intake_quotas. All components non-NULL. quota_date is slot local date and category equals frozen offer category. Positive revision. receivable_until = slot end + captured 30-minute policy. Terminal state requires closed_at/reason, human closed_by for cancellation/reception; no_show is system-owned. No UNIQUE(donation_id).

**Indexes:** UNIQUE(offer_id); UNIQUE(id,offer_id,donation_id,association_id); (donation_id,created_at DESC,id DESC); (association_id,created_at DESC,id DESC); (slot_id,id); (association_id,category,quota_date); (closed_by) WHERE closed_by IS NOT NULL; (receivable_until) WHERE status=booked.

### inventory_movements

Actual full receipt or full distribution of a lot. **Ownership:** Target association; donor sees derived item stock status only. **Trace:** FR-022, FR-024, FR-036.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Movement identifier. |
| `donation_id` | `uuid` | no | FK → donations.id | none | Source donation. |
| `association_id` | `uuid` | no | FK → associations.id | none | Receiving tenant, agrees with offer and booking. |
| `movement_type` | `movement_kind` | no | — | none | receipt or distribution. Allowed labels: `receipt`, `distribution`. |
| `quantity` | `numeric(12,3)` | no | — | none | Positive explicit quantity; sign determined by movement_type in code. |
| `unit` | `quantity_unit` | no | — | none | Same item unit as donation/need/quota; storage has its separate place unit. Allowed labels: `item`. |
| `actor_id` | `uuid` | no | FK → profiles.id | verified staff | Human recording the physical event. |
| `created_at` | `timestamptz` | no | — | now() | Physical event recorded at. |
| `offer_id` | `uuid` | no | FK → donation_offers.id | command | Fulfilled attempt whose immutable facts/storage rate describe this stock. |
| `booking_id` | `uuid` | no | FK → bookings.id | command | Original received appointment, including for later distribution. |

**Constraints / guards:** PK(id). Scoped composite FKs to offer and booking keep item/tenant/appointment identical. Partial UNIQUE(donation_id) WHERE movement_type=receipt and another WHERE movement_type=distribution: at most one physical receipt and one full distribution over all attempts. Quantity equals the lot; no partial/reversal in MVP. No product UPDATE/DELETE.

**Indexes:** partial unique receipt/distribution indexes on donation_id; (donation_id,created_at,id); (association_id,created_at DESC,id DESC); (offer_id); (booking_id); (actor_id).

### api_requests

Private durable retry/analysis-request identity. **Ownership:** No client policy/grant. **Trace:** NFR-004, NFR-006; FR-038.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Internal request identifier. |
| `actor_id` | `uuid` | no | FK + UK → profiles.id | verified actor | Identity scope; never supplied as a trusted client field. |
| `operation` | `text` | no | UK | server route identity | Method + canonical resource path; prevents cross-endpoint key collisions. |
| `idempotency_key` | `uuid` | no | UK | request header | Caller retry key scoped to actor and operation. |
| `request_hash` | `text` | no | — | server digest | SHA-256 of canonical validated payload including expected_revision / relevant file digest. |
| `state` | `request_state` | no | — | in_progress | Request processing state. Allowed labels: `in_progress`, `completed`, `failed`. |
| `attempt_id` | `uuid` | no | — | generated UUID | Lease owner/fencing token for external-call completion. |
| `lease_until` | `timestamptz` | yes | — | configured timeout | Required for in-progress external operations; no transaction held during provider calls. |
| `resource_id` | `uuid` | yes | — | NULL | Result reference; polymorphic metadata, deliberately not a SQL FK. |
| `http_status` | `smallint` | yes | — | NULL | Successful status for completed request, safe error status for a failed operation. |
| `result_refs` | `jsonb` | yes | — | NULL | Stable resource/event references and action outcome only; no computed expiry/balances, QR payload, signed URL, credentials or raw bytes. |
| `created_at` | `timestamptz` | no | — | now() | Retry claim created at. |
| `context` | `jsonb` | no | — | validated server input | For analysis: donation_id, captured facts revision and immutable photo IDs/digests; no derived values or raw bytes. |
| `failure_code` | `text` | yes | — | NULL | Allowlisted safe failure code, never raw upstream response. |

**Constraints / guards:** PK(id); UNIQUE(actor_id,operation,idempotency_key). Context/hash fixed at registration; request context is never donor-replaced on retry. Only current attempt_id may complete. Completed result_refs allowlist contains stable IDs/outcomes only; failed contains a safe failure_code. Referenced analysis/request context survives ordinary retry-cache cleanup. No response snapshots, computed expiry, balances, QR or secrets.

**Indexes:** UNIQUE(actor_id,operation,idempotency_key); (lease_until) WHERE state=in_progress.

## What attributes means

Keep attributes for category-specific item facts (garment type/size/season, shoe size/type) and confirmed need criteria. It is not generic metadata. Validate keys/types per category/context; typed date facts live in expiry_info, quantity/unit in their columns. Original extraction remains in donation_analysis.extracted; provider/model/photo provenance is separate. An offer freezes the validated working facts and source dates; it never relabels or overwrites old indicators. Category keys/nulls/values are fixed by analysis-v1; model keys are required/nullable, human allowed keys may be omitted and normalized to null.

## Relationship cardinality and scope constraints

Each accepted donation_photos row has exactly one immutable private.photo_contents row by the atomic upload contract (FK allows zero-or-one until that command completes). Content references exactly one photo; no independent ownership. A donation has zero-to-many offers, photos, analyses and item-change events; zero-or-one current expiry row. A need/association has zero-to-many offers. Each offer has zero-or-one booking under the MVP profile and zero-to-many immutable events. A donation can have many historical bookings through different attempts, but one full receipt across all attempts. Booking cancellation is not a permanent item booking constraint.

Profiles and associations are M:N through association_members. Membership events reference both the affected membership's composite key and the verified actor. An association has zero-to-many category capacity/needs/dated quotas/slots. Slots and quotas have many historical bookings. A successful analysis belongs to exactly one durable private request; a request has at most one successful original result. Each analysis has zero-to-many indicators.

Same-tenant/item constraints supplement per-column FKs:

- donation_offers(need_id,association_id) → needs(id,association_id).
- donations(basis_analysis_id,id), donation_offers(basis_analysis_id,donation_id) and donation_edits(basis_analysis_id,donation_id) → donation_analysis(id,donation_id).
- offer_events(offer_id,association_id) → donation_offers(id,association_id).
- bookings(offer_id,donation_id,association_id) → donation_offers(id,donation_id,association_id); bookings(slot_id,association_id) → slots(id,association_id).
- bookings(association_id,category,quota_date) → intake_quotas(association_id,category,service_date); command additionally checks category equals frozen offer category and date equals slot local date.
- inventory_movements(offer_id,donation_id,association_id) → donation_offers; inventory_movements(booking_id,offer_id,donation_id,association_id) → bookings(id,offer_id,donation_id,association_id).
- membership_events(association_id,profile_id) → association_members(association_id,profile_id).

Supporting unique groups are defined in the table guards above. All components of booking/inventory scope keys are non-NULL. Optional basis IDs may be NULL, including on a valid manual offer. JSON photo/request/edit whitelists are not SQL FK constraints: commands verify they belong to the item, freeze them, and retention code must honor references. Cross-row aggregates, active membership, temporal eligibility and inventory balance are checked under locks, not disguised as CHECK constraints. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

## RLS, grants and write capabilities

U is the verified auth.uid() subject. Enabled(U) means its protected profile is not disabled. Member(a) requires Enabled, an active membership and an approved association; Admin(a) also requires assoc_admin. Platform(U) reads the protected profile capability, never user_metadata or unrefreshed role claims. Own(d) requires Enabled and donation.donor_id=U.

ReadOffer(o) = Own(o.donation_id) OR Member(o.association_id). Staff **never obtain the raw current donation row merely because they received an earlier offer**. ReadPhoto/ReadAnalysis/ReadEdit = owner OR explicitly referenced evidence in a ReadOffer snapshot. Analysis uses the frozen request-ID whitelist, so a previously registered request may finish later without exposing a future request from another attempt. Read-only computed inventory/expiry views use the fulfilled offer snapshot, not donor facts changed after an unrelated offer closed.

| Entity | Authenticated SELECT specification | Mutation authority |
|---|---|---|
| profiles | Own enabled profile only. | Own display name; protected platform_role/disabled_at are trusted provisioning only. |
| associations | Active member, its registered applicant, or platform approval operator. | Applicant creates/fixes pending registration; approved own admin configures; platform approval/restricted recovery only. |
| association_members | Own membership rows, including inactive status, or active admin's own roster. | Pending bootstrap and activation are atomic commands; admin grant/role/revoke/transfer; constrained platform recovery. |
| membership_events | Affected user's own history or current own association admin. | Append from the same membership command; no arbitrary caller-written history. |
| needs, capacity, intake_quotas, slots | Member(association_id). | Own assoc_admin only. Matching/slot DTOs use narrow donor projections, not broad table policies. |
| donations, expiry_info | Own donation only. | Owner edits/publishes/withdraws/restores in allowed state; trusted receipt changes disposition to transferred. |
| donation_offers, offer_events | ReadOffer or parent offer. | Owner submits/withdraws; target personnel decide/cancel; code expires; receipt fulfils; immutable history appended. |
| donation_photos, donation_analysis, donation_indicators, donation_edits | Owner or explicit evidence whitelist inherited from a readable offer. Indicators inherit their analysis. | Server-only validated append; owner fact changes/guarded item-disposition journal. No original result mutation. |
| bookings | Owner or target member via its offer, with scoped FKs. | Owner books; owner/target personnel cancel; code marks no_show; target personnel explicitly receive with server-verified QR. |
| inventory_movements | Target Member only; owner receives its item's derived stock status DTO. | Target personnel record actual full receipt/distribution once. |
| redirect_points | Enabled authenticated subject and active reference. | Seed/provisioning only. |
| private.photo_contents | Private schema, no anon/authenticated SELECT grant. Defense-in-depth SELECT policy is Enabled(U) AND ReadPhoto(photo_id), inheriting owner/association whitelist scope; grants still deny direct client access. | Server-only append with metadata; narrow read capability verifies current enabled actor and ReadPhoto scope. No client access or payload mutation. |
| private.api_requests | No browser SELECT grant/policy. | Internal durable command/analysis lease identity only. |

Enable RLS before table exposure and grant only intended reads. Revoke ordinary client INSERT/UPDATE/DELETE and default function EXECUTE. Use indexed predicates and cached auth.uid() subqueries where appropriate. Own/admin roster rules must avoid recursive membership-policy queries: narrowly audited private read helpers can inspect membership/protected profile rows with pinned search_path and auth.uid() checks. Private schema is not exposed through the Data API. Any helper bypass of RLS is deliberate, reviewed and constrained to identity lookups. Views use security_invoker=true or remain private. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

For the proposed MVP, business-write entry points are **server-only capabilities**, invoked by FastAPI after bearer verification. Private command bodies schema-qualify objects, pin search_path, run with least necessary ownership, reject unknown actor/disabled profile, repeat current role/tenant/field/state checks, and accept only allowlisted parameters. Exposed invoker wrappers, if needed by PostgREST, grant EXECUTE only to the server role; anon/authenticated must not call them. A caller-supplied actor UUID does not authorize an ordinary client. The privileged credential bypasses RLS, so these explicit checks and immutable-row guards are essential; never claim RLS alone secures privileged writes. No general SQL/update RPC exists. Ordinary reads continue under the user's JWT and RLS. Matching/QR/analysis-status projections are individually authorized and field-allowlisted. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)

Membership provisioning follows DEC-008/010/011: pending inactive initial admin, atomic platform activation, known existing profile grants, guarded role transfer, last-admin protection, immediate database revocation and audited constrained orphan recovery. No membership request can choose its own granting actor. The same association mutex serializes role changes with decisions/reception, so a stale JWT or retry cannot restore revoked rights.

### Photo storage

**User-selected design: base64 in Postgres, no Supabase Storage.** donation_photos holds ID, item/owner link, MIME, decoded size, SHA-256 and photo kind; private.photo_contents holds image_base64 text keyed by photo_id. Keep the private schema out of Data API exposure, revoke ordinary payload access and enable RLS as defense in depth. No bucket, object path, Storage policy or signed object URL is required.

FastAPI accepts multipart bytes, validates ownership/state and actual file content/type/size/count, calculates decoded size/digest, and encodes canonical base64 before entering the write transaction. One restricted command rechecks permissions/item state/limits and inserts metadata + content + facts revision/journal + retry references atomically. Retry references contain photo IDs only. A failed transaction leaves neither half committed; there is no cross-service orphan-upload saga. Base64 is encoding, not encryption.

GET /photos/{photoId}/content is the sole product content read path. Its restricted server capability rechecks the current enabled owner or recipient-whitelist membership against the same photo and fetches only that private row. It cannot trust a previous UI authorization or a caller-supplied actor. Decode the retained text, verify expected byte count/digest, then return no-store binary with validated MIME. A missing/corrupt private row is an integrity/server error, never a successful empty image or a public fallback. The frontend fetches with bearer auth and can display a temporary browser blob URL; it never queries the private table directly. Analysis uses the same authorized immutable photo ID/digest and reads content only for its captured request.

Do not join/select the payload in donor/offer/gallery/count/FEFO lists, matching, audit snapshots or the retry ledger. Metadata queries explicitly project their fields. Photo IDs/digests in frozen evidence remain unchanged; re-offering grants only the original per-offer whitelist. Bulk content listing/export is outside MVP. Retention/deletion must coordinate metadata/content and all evidence references in the same reviewed cleanup policy (AMB-015).

### Encoding and resource limits

Store standard padded RFC 4648 text, not a data URI or JSON wrapper. An accepted n-byte file encodes to 4 × ceil(n/3) characters, about 33% extra for large files before database compression/backup overhead. This follows the [base64 format](https://datatracker.ietf.org/doc/html/rfc4648#section-4); it is not a measured database-size claim. PostgreSQL supports decode/encode, but its base64 encoder inserts line feeds; normalize them if used for canonical equality. [PostgreSQL conversion functions](https://www.postgresql.org/docs/current/functions-binarystring.html)

Bound both multipart decoded bytes and encoded payload length before database admission. Also budget decode memory, command/request body size, gallery content fan-out and database backup growth. Exact upload/deployment limits remain AMB-003/019; choosing base64 does not make those unlimited. Keep the payload as text in its own private table, not JSONB on donations; no payload index or public raw-base64 REST collection is introduced. Supabase still supplies Auth, Postgres and RLS. [RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Atomic transactions and concurrency

One business command uses one PostgreSQL transaction/function invocation, not a sequence of independent Supabase REST writes. No network/model call holds database locks. Read preliminary affected parent IDs, lock in the order below, then recheck the relationships; if parent IDs changed, abort/retry instead of acquiring a new parent out of order.

Global order: durable request identity → affected profile rows sorted (including member-management subjects) → association rows sorted by UUID → membership rows sorted → donation rows sorted → category capacity rows sorted → need rows sorted → dated quota rows sorted → slots sorted → offers sorted → bookings sorted → audit/movement children. Association rows are exclusive mutexes for every intake/configuration/membership write; member checks also lock the applicable membership. Revocation uses the same order. Item-only fact/photo/analysis-start commands evaluate effective (deadline-aware) offer activity under their donation lock; an elapsed stored active row does not block corrections. They lock only the item then children, need not materialize the row and never later acquire association locks. Every offer/booking command also locks the item, so this guard is race-safe. New-association bootstrap inserts its parent/child/audit in one transaction. Re-offering across A→B includes both old and new parent associations in sorted order.

After locks, use a single authoritative database clock reference and fresh READ COMMITTED aggregate statements. Existing parent locks protect empty child sets, so two requests cannot both claim a last place by only locking existing bookings. Every writer participates. Revisions protect stored facts and configuration; live aggregate checks prevent oversubscription. A failed user operation rolls back its business changes; incidental expiry materialization may roll back too, while deadline-aware reads still exclude the expired reservation. The dedicated reconciliation command can commit due events independently.

| Command | Checks | Atomic effect |
|---|---|---|
| Register / approve association | Verified caller or platform capability; identifiers; original pending applicant. | Insert pending association/inactive admin/event; or approve and activate that admin/event together. |
| Grant/revoke/transfer membership | Current own admin; target existing enabled profile; expected membership revision; last-admin invariant. | Update membership(s), increment versions and append events; no role claims trusted. |
| Correct/publish/withdraw/restore item | Owner; allowed item disposition; no active offer for edits/publish/restore; expected revision. | Write source facts/date facts plus change journal. Item withdrawal also closes its active offer/booking and releases holds in the same transaction. |
| Persist analysis | Restricted server capability, original request/lease fence, item/photo context. | Append original+indicators once; attach missing basis independently; seed only untouched empty/current/no-offer facts. No staff decision or snapshot rewrite. |
| Submit offer | Owner; ready item; current complete facts/photos; no live offer after expiring a due prior attempt; approved target; current independent budgets/season/slot existence. | Insert new offer snapshot/deadline and initial event. No reservation and no successful-AI prerequisite. |
| Approve / refuse | Target current personnel; pending effective state/revision. Approval rechecks need/storage/season/future slot+quota and human intake/availability acknowledgements. | Write human decision once and event. Approval freezes current staff storage rate and sets 24-hour booking deadline; refusal closes only this attempt. |
| Book | Owner; approved live offer; no prior booking for this offer; future target slot within seven days; sufficient slot/quota. Credit this offer's own existing need/storage hold. | Insert booked appointment and snapshot date/address/timezone/grace; append offer booked event. Hold extends only until receivable_until; no duplicate need/storage reservation. |
| Cancel / withdraw attempt | Authorized owner/target staff; not physically received. | Close offer, cancel any booked appointment, append history, invalidate QR and release demand/storage/quota/place. Item stays ready unless the item itself was withdrawn. |
| Reconcile expiry / no-show | Cutoff reached, same locks; no caller extension/decision authority. | Pending→expired at review cutoff; unbooked approved→expired at booking cutoff; overdue booked→no_show and offer→expired. Append one effective/recorded event; no stock. |
| Confirm reception | Server-verified QR; current target membership; offer/booking/item state; receipt window; expected booking revision; no prior receipt. | One full receipt + offer fulfilled + booking received + item transferred + events together. Holds become actual stock/fulfilled demand/consumed quota without double counting. |
| Distribute | Target personnel; matching receipt ID; received lot; no prior distribution; full lot only; current expiry-v1 guard/acknowledgements and human reason when needed. | Append full distribution once; no appointment or offer state/version change. Release storage, not demand or daily quota. |

Partial UNIQUE(donation_id) for pending_review/approved offers enforces stored-state exclusivity. It intentionally contains no now() predicate: expire the prior row under locks before a replacement insert. Reads compute effective state/live availability against recorded deadlines even while a stale stored state awaits reconciliation. No counter needs a scheduled decrementation to free capacity. A bounded POST reconciliation command and normal successful writes persist history; a scheduler is optional maintenance, never correctness infrastructure. [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html), [row locks](https://www.postgresql.org/docs/current/explicit-locking.html)

### Durable retries and external-call fencing

Profile bootstrap first establishes/locks its subject profile so the ledger actor FK exists, then records its retry identity in the same transaction. This provisioning-only exception touches profile/ledger only, takes no association locks and cannot escalate roles. Concurrent bootstrap converges on the Auth-subject profile PK.

private.api_requests claims actor + canonical operation + retry key with a hash of validated immutable payload. Reauthorize before replay. Successful actions return the same created resource/event identity and original success status while rebuilding current authorized DTOs/derivatives; do not cache literal expiry/balance/count/mismatch responses. Reused key/different payload conflicts; already completed same-key replay bypasses the old expected_revision check after current authorization. Closed/expired offer state is reflected in a replayed DTO, not resurrected as an active action.

Photo/analysis operations register immutable input context and a lease/attempt ID, release the transaction, then call external systems. Only the current fenced attempt may commit. A successful late run remains valid evidence even when seeding is disallowed. Failed runs have a safe failure status/code, never an empty successful analysis. Expired leases can be recovered with compare-and-swap fencing and the same immutable context; new analysis inputs need a new request identity and are blocked while an offer is active. Logical once-only effects do not guarantee exactly-once provider billing. Retry retention/timeouts remain operational decisions; contexts referenced by analyses/offer scopes cannot be discarded as ordinary cache entries.

## Read-time expiry and deterministic matching

Current source dates remain in expiry_info; historical/offered source dates stay in immutable facts snapshots; original model dates stay in original extraction. Python calculates days/expired/buckets/FEFO on each read, with explicit reference date/association timezone and versioned shelf-life policy. Inventory/expiry counts use fulfilled received-undistributed lots and avoid duplicate joins across historical offers. Unknown/unreadable is never zero days or false expiry. PAO does not invent an opening date.

[Expiry-v1](expiry-rules.md) now resolves today/exact-90, non-overlapping buckets, partial-label boundaries, human opening state/date, calendar-month PAO, DLC versus DDM and deterministic FEFO. Source facts stay in existing columns/JSON; the schema has no derived date/group/rank column. [Analysis-v1](analysis-rules.md) defines extracted JSON and indicator keys/levels/confidence; no new enum/table/column or migration is needed. Future fixtures are in [rules-test-cases.md](rules-test-cases.md).

FastAPI evaluates item-date guards in Python before the existing atomic restricted command. The command under locks compares source/offer revisions, completed scoped analysis IDs and the supplied reference-day UTC instant fence against database time; it returns date_context_stale if any changed. These are revision/instant comparisons, not SQL item-expiry computation. Do not accept guard context from public clients, persist it in result_refs or run an external/Python callback while locks are held. Human date acknowledgements/reason are source audit facts and may be captured in existing intake_checks/offer_events or private command context; computed expiry is not. Receipt/distribution date acknowledgements and human reason are retained in private.api_requests.context with result_refs pointing to the immutable movement identity; preserve that audit context when retiring ordinary retry keys (AMB-015). No request/response expiry view is retained.

Matching performs deterministic need/season/storage plus a future intake quota/slot feasibility check, then Haversine ordering with stable IDs. Donor origin is request-scoped; no radius eligibility gate is selected, so review need not revalidate a discarded origin. Approved association address/coordinates must be usable. There is no model, route optimization or transport table.

## Verification and external documentation

Before migrations, review exact definitions/grants/functions and remaining upload/retention/deployment decisions and the specified analysis-v1/expiry-v1 contracts. Test refusal→re-offer same item; double-submit exclusivity; expired stale-row replacement without a scheduler; independent demand/storage/quota failures; last-place quota/slot races; simultaneous cancellation/receipt/expiry; no duplicate/full-only stock effects; pending bootstrap, grant/last-admin/transfer/revocation/recovery; direct Data API/RPC/private-photo isolation after re-offering; and delayed first analysis after correction/fallback offering. The backend toolchain and PostgreSQL/RLS tests now exist; see readiness.md for executed evidence. The 25–35-photo evaluation set remains a separate pending gate.

Supabase's current [changelog](https://supabase.com/changelog?types=breaking-change), [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [password authentication guide](https://supabase.com/docs/guides/auth/passwords) inform this design. Explicit grants, enabled RLS, private helpers and current membership checks remain essential. No remote project was modified.

Current diagram validation and any dense-layout warnings are linked in [architecture.md](architecture.md#validation-evidence). Those checks validate an artifact, not these database policies or transactions.

## Implementation boundary

Migrations use the imperative Supabase CLI workflow; their versioned filenames were generated with `supabase migration new`. They create all 21 application tables and 25 enum types, scoped read policies, immutable original-evidence/history triggers, independent deadline-aware budget aggregates and service-only command RPCs. No hosted project has been changed.

`dono_command_owner` is a NOLOGIN role owning only Dono application objects. Managed Supabase does not support granting that role direct access to the `auth` schema. Two private helpers, `current_user_id()` and `auth_user_exists(uuid)`, are owned by `postgres`, use `SECURITY DEFINER` with an empty search path, and allow execution only by the command owner. They return only a UUID or an existence boolean. Existing business commands and scope predicates retain their restricted owner. No helper can mutate Auth data. RLS is enabled for ordinary readers; table-owner command execution deliberately bypasses row filtering and repeats actor/tenant/state checks. Ordinary authenticated clients have SELECT policies and no DML. The service role has command execution rather than direct application-table DML. Function search paths are pinned; future functions/tables do not automatically receive client privileges.

The applicant exception for association reads is limited to pending registration; after approval, current membership or platform verification capability is required. This resolves the broader applicant wording in the earlier table dictionary in favor of the API's G/M/P scopes. Raw donor facts remain owner-only.

The approved upload policy is JPEG/PNG/WebP, 4 MiB decoded per image, three images per donation and 20 million pixels. The analysis lease is 120 elapsed seconds and provider timeout defaults to 60 seconds. Changing database-bound limits requires a matching migration. Operational seven-day booking horizons use 168 elapsed hours, including DST transitions. Item expiry is still computed only in Python at read time.
