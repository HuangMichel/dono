# Dono database design

Status: **proposed design for review; no database objects, migrations or backend code have been created**. [AGENTS.md](../AGENTS.md) remains authoritative. Read this with [requirements.md](requirements.md), [features.md](features.md), [architecture.md](architecture.md) and the [FastAPI REST contract](api.md).

Open the [interactive database ERD](architecture/database-erd.html); its editable source is [database-erd.json](architecture/database-erd.json). Every proposed application column is included. `auth.users` is shown as an external managed reference containing only its referenced `id`, not as a complete definition of Supabase's Auth schema. Each FK role has its own relationship line, including separate applicant/approver and donor/reviewer roles; column references and composite constraints below provide the precise keys.

## Design status and provisional choices

The 13 required entities are all covered. Three small supporting tables make photo validation, correction provenance and durable retries explicit: `donation_photos`, `donation_edits` and `private.api_requests`. They implement existing requirements rather than new donor-facing features. The ERD is a design artifact, not reverse-engineered production evidence.

The following choices make one coherent schema/API/transaction proposal reviewable. They **do not resolve the product ambiguities** in requirements.md. Do not generate migrations until the affected policies are agreed; unsupported later transitions must not be inferred from this design.

| Proposal | Proposed implementation profile | Open decision / requirements |
|---|---|---|
| DB-P01 | Every account can act as a donor; platform approval capability is a protected profile value, and per-association staff/admin roles are memberships. Only admins configure intake in this proposal. Registration stores the verified applicant and at least one provided RNA/SIRET; initial admin provisioning remains unimplemented pending policy. | AMB-001/002; FR-001/002 |
| DB-P02 | One current target need/association and one booking per donation. Freeze working facts after offering; no cancellation, re-offering or decision reversal in the proposed endpoints. One full receipt; partial distribution is structurally representable but unavailable until its policy is agreed. `draft` is a proposed physical pre-offer status, refining the architecture's conceptual Preparing stage. | AMB-004/010/012/013; FR-010/015/023/024 |
| DB-P03 | `numeric(12,3)` quantities with an explicit unit shared by donation, need and category capacity. Examples use `item`; item quantities must be integral. Unit vocabulary and real-world capacity measurements require agreement; no implicit kg/volume conversions. | AMB-008; FR-003/005/022 |
| DB-P04 | Reserve category capacity and need demand at staff approval; keep the hold through booking; reception converts the hold to actual stock/fulfilled need; distribution releases stock capacity without reopening fulfilled need. Availability is calculated, not stored in counters. | AMB-008; FR-005/014/017/022 |
| DB-P05 | Slots limit the number of committed drop-offs, independently of quantity capacity. QR references use a server-signed booking ID/nonce/deadline; nonce alone is not authority. Lifetime, slot policy and reception exceptions remain required decisions; do not substitute a default TTL or timezone. | AMB-010/011/013; FR-023/024 |
| DB-P06 | Validate probabilities/confidence against the proposed finite [0,1] contract and preserve their decimal values without database rounding; retain provider/model attribution. Final indicator keys and schema-specific attribute vocabulary remain open. API/provider selection never comes from model instructions or donor-supplied provenance. | AMB-017/018; FR-008/009/011/026 |
| DB-P07 | Staff approval records explicit intake assertions: not a medicine, and eligible room-temperature non-perishable food when applicable. False assertions cannot pass approval. Thresholds/clarification and DLC/DDM handling must be agreed; an AI warning never writes a refusal. | AMB-007; BR-001/004/005 |

## Conventions and ownership

All tables below are proposed in `public` except `private.api_requests`. Use RLS on every application table, including the private ledger as defense in depth. No anonymous product-data access is proposed. Ordinary `authenticated` clients receive selected read access only; guarded commands own product writes. Public schema placement is not an automatic exposure grant.

IDs are UUIDs to align with Supabase identities and exposed resource references. For this small MVP, the proposal uses generated UUIDs without a UUIDv7 extension; revisit locality only if measured scale warrants it. Store human text as `text`, instants as `timestamptz`, exact label dates as `date`, exact quantities as `numeric`, and category-specific validated facts as `jsonb`. JSON is not a substitute for indexed ownership keys or arithmetic columns. `revision` is a positive bigint; API quantities and bigint values are decimal strings to preserve precision.

`created_at`/`updated_at`, IDs, actors, status and revisions are server/command-owned. No client can select a donor ID, assign membership, change target association through a generic patch, or edit original evidence. FK actions are **ON DELETE RESTRICT / ON UPDATE RESTRICT** until retention/deletion policy AMB-015 is resolved. There are no product hard-delete endpoints. This protects provenance without asserting perpetual retention; a later authorized retention process needs its own reviewed deletion order.

Categories are `clothes`, `shoes`, `food`, `para`, `furniture`. Finite vocabularies use named PostgreSQL ENUM types, defined below and repeated with allowed values at each table column. Types are schema-level objects referenced by columns; PostgreSQL does not declare MySQL-style inline ENUM lists in CREATE TABLE. No types or migrations have been created. Required strings reject empty values; all numeric inputs reject NaN/infinity in addition to range checks. Defaults listed as actor/config/output are trusted sources, not SQL default expressions. A nullable column is intentionally different from an empty or guessed value.

## Enumerated types

The enum catalog is a design definition, not executable SQL. Shared types (especially category and unit) are reused across tables so constraints and API validation agree. Each future PostgreSQL `CREATE TYPE … AS ENUM` precedes dependent tables. Python string enums/Pydantic schemas and frontend wire unions must use the same labels. New labels require a reviewed schema/API change; enum ordering never determines donation lifecycle or matching rank. [PostgreSQL enum types](https://www.postgresql.org/docs/current/datatype-enum.html)

| SQL enum type | Allowed labels | Decision status |
|---|---|---|
| `platform_role` | `donor`, `platform_admin` | Established role labels; provisioning remains AMB-001/002. |
| `assoc_role` | `assoc_admin`, `assoc_staff` | Established membership labels; management permissions remain AMB-001. |
| `association_status` | `pending`, `approved` | Proposed onboarding profile; rejection/reversal remains AMB-002. |
| `redirect_kind` | `pharmacy`, `textile_bin`, `repair_cafe` | Existing MVP redirection kinds. |
| `donation_category` | `clothes`, `shoes`, `food`, `para`, `furniture` | The five required categories. |
| `quantity_unit` | `item` | Initial DB-P03 proposal only; other units/capacity interpretation require AMB-008. |
| `need_season` | `spring`, `summer`, `autumn`, `winter` | Proposed vocabulary pending AMB-009; NULL remains unknown, not all seasons. |
| `donation_status` | `draft`, `offered`, `approved`, `refused`, `booked`, `received`, `distributed` | DB-P02 proposal; conceptual error stages are not enum labels. |
| `donation_decision` | `approved`, `refused` | Human decision only. |
| `photo_kind` | `item`, `label` | Existing capture roles. |
| `analysis_provider` | `openai`, `jev`, `hybrid` | Provider contract; optional modes remain disabled pending AMB-018. |
| `indicator_provider` | `openai`, `jev` | Actual indicator component attribution. |
| `indicator_level` | `low`, `medium`, `high` | Optional provider level; never an acceptance verdict. |
| `expiry_date_type` | `DLC`, `DDM`, `expiry`, `PAO` | Source label type from AGENTS.md. |
| `date_precision` | `day`, `month`, `year`, `unknown` | Proposed source precision; normalization remains AMB-006. |
| `date_readability` | `readable`, `unreadable`, `unknown` | Proposed source readability. |
| `movement_kind` | `receipt`, `distribution` | Actual physical stock events; reversals not included. |
| `request_state` | `in_progress`, `completed` | Internal durable retry protocol. |

`quantity_unit` initially proposes only `item`; this does not silently approve kg, volume, pack conversion or capacity semantics. The four season labels are also provisional. Finalizing these two vocabularies remains AMB-008/009. Existing quantities/season examples now have explicit proposed types instead of unbounded text.

Free-form names, addresses, model identifiers, storage paths, IANA timezones, MIME strings and schema-versioned indicator keys remain text with their appropriate validators. They are not interchangeable with the closed enum fields. Category-specific JSON attributes are validated by schema/context, not converted into a universal enum.

## Data dictionary

PK/UK badges indicate participation in a key; composite UKs do not make each participating column independently unique. PK/UK indexes exist by virtue of their corresponding constraints; do not add duplicate plain indexes. Every FK has a supporting leading-key index, either its PK/UK or an explicit index below. Nullable-FK partial indexes cover all non-NULL references; active-only indexes do not replace full FK support for inactive referencing rows. Index names are deliberately left to migrations; definitions and reasons are specified here. Nonnegative/positive checks apply to quantities before any unit-specific validation.

### profiles

Application identity; association roles live in memberships. **Ownership:** Account owner; platform role is provisioning-only. **Trace:** FR-001; NFR-001 / NFR-002.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + FK → auth.users.id | Auth subject | Same identifier as managed auth.users.id; never caller-selected. |
| `display_name` | `text` | yes | — | NULL | Optional own display name; no automatic donor identity disclosure to staff. |
| `platform_role` | `platform_role` | no | — | donor | donor or platform_admin; protected from self-update. Allowed values: `donor`, `platform_admin`. |
| `revision` | `bigint` | no | — | 1 | Positive write version, incremented by commands. |
| `created_at` | `timestamptz` | no | — | now() | Creation instant. |
| `updated_at` | `timestamptz` | no | — | now() | Last profile edit. |

**Constraints and guards:** PK(id); FK(id) → auth.users(id). platform_role ∈ {donor, platform_admin}; revision > 0. Staff/admin capabilities additionally come from active membership rows.

**Indexes:** PK index covers ownership and Auth FK.

### associations

Registration, intake location, hours and platform approval. **Ownership:** Applicant registration; approved association configuration belongs to its members. **Trace:** FR-002 / FR-006 / FR-013.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Association identifier. |
| `name` | `text` | no | — | none | Nonempty display name. |
| `registered_by` | `uuid` | no | FK → profiles.id | verified actor | Applicant identity; bootstrap policy remains AMB-002. |
| `rna` | `text` | yes | — | NULL | RNA identifier as text; validation/requiredness awaits AMB-002. |
| `siret` | `text` | yes | — | NULL | SIRET as text, preserving leading zeros; validation awaits AMB-002. |
| `approval_status` | `association_status` | no | — | pending | pending or approved; association approval is not a donation decision. Allowed values: `pending`, `approved`. |
| `approved_by` | `uuid` | yes | FK → profiles.id | NULL | Platform actor only. |
| `approved_at` | `timestamptz` | yes | — | NULL | Approval instant, paired with approved_by. |
| `display_address` | `text` | yes | — | NULL | Intake address, donor disclosure controlled by projection. |
| `latitude` | `double precision` | yes | — | NULL | Verified geocoding coordinate; no fabricated fallback. |
| `longitude` | `double precision` | yes | — | NULL | Verified geocoding coordinate. |
| `timezone` | `text` | yes | — | NULL | Validated IANA zone once AMB-011 is resolved. |
| `opening_hours` | `jsonb` | no | — | [] | Proposed weekly intervals: weekday, start_local, end_local; slot commands validate against them. |
| `revision` | `bigint` | no | — | 1 | Positive command version. |
| `created_at` | `timestamptz` | no | — | now() | Registration instant. |
| `updated_at` | `timestamptz` | no | — | now() | Last configuration/approval change. |

**Constraints and guards:** Approval fields all absent while pending, all present while approved; only a platform command can change them. Coordinates are both NULL or both valid: latitude [-90,90], longitude [-180,180]; reject non-finite values. Nonempty name; opening_hours is an array of validated intervals. Registration identifiers and opening-hours vocabulary remain proposed, not settled product rules. No global RNA/SIRET uniqueness constraint is assumed before multi-location identity policy is resolved under AMB-002.

**Indexes:** (registered_by, created_at DESC, id DESC) for applicant reads / FK. (approved_by) WHERE approved_by IS NOT NULL for actor FK. (approval_status, created_at DESC, id DESC) for platform review and eligible association lookup.

### association_members

Association-scoped roles; no editable JWT user_metadata authorization. **Ownership:** Membership provisioning; users read only their own memberships. **Trace:** FR-001; AMB-001 / AMB-002.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `association_id` | `uuid` | no | PK + FK → associations.id | none | Association in composite PK. |
| `profile_id` | `uuid` | no | PK + FK → profiles.id | none | Member in composite PK. |
| `role` | `assoc_role` | no | — | none | assoc_admin or assoc_staff. Allowed values: `assoc_admin`, `assoc_staff`. |
| `active` | `boolean` | no | — | true | Current authorization flag; historical actor references remain intact. |
| `created_at` | `timestamptz` | no | — | now() | Membership provisioned at. |

**Constraints and guards:** PK(association_id, profile_id); one current role per user per association. role ∈ {assoc_admin, assoc_staff}; role assignment/revocation workflows remain AMB-001.

**Indexes:** PK covers association FK. (profile_id, association_id) WHERE active for current membership checks. (profile_id) for the full profile FK, including inactive rows.

### redirect_points

Shared pharmacy, textile-bin and repair-café references. **Ownership:** Seed/provisioning data; no MVP management UI or external integration. **Trace:** FR-012; BR-004 / BR-006.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Reference identifier. |
| `kind` | `redirect_kind` | no | — | none | pharmacy, textile_bin or repair_cafe. Allowed values: `pharmacy`, `textile_bin`, `repair_cafe`. |
| `name` | `text` | no | — | none | Destination name. |
| `address` | `text` | no | — | none | Human-readable location. |
| `latitude` | `double precision` | yes | — | NULL | Optional known coordinate. |
| `longitude` | `double precision` | yes | — | NULL | Optional known coordinate. |
| `description` | `text` | yes | — | NULL | Informational guidance, not a message channel. |
| `active` | `boolean` | no | — | true | Visible shared listing. |

**Constraints and guards:** Nonempty name/address; allowed kind; coordinate-pair validity as for associations.

**Indexes:** (kind, id) WHERE active for filtered listings.

### capacity

Configured category intake ceiling; no stored occupancy counters. **Ownership:** Association members; configuration command limited to admins in the proposed permission profile. **Trace:** FR-005 / FR-014 / FR-022.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `association_id` | `uuid` | no | PK + FK → associations.id | none | Stable parent row locked by capacity-changing commands. |
| `category` | `donation_category` | no | PK | none | One of the five product categories. Allowed values: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `unit` | `quantity_unit` | no | — | none | Explicit agreed unit; no model conversion or inferred kg. Allowed values: `item`. |
| `limit_quantity` | `numeric(12,3)` | no | — | none | Configured nonnegative ceiling, not computed free capacity. |
| `revision` | `bigint` | no | — | 1 | Positive write version. |
| `updated_at` | `timestamptz` | no | — | now() | Last limit/configuration change. |

**Constraints and guards:** PK(association_id, category); limit_quantity >= 0 and finite; unit nonempty. A limit decrease cannot fall below current committed occupancy; unit/category changes are forbidden while referenced commitments exist.

**Indexes:** PK covers association FK and the category lock/read path.

### needs

Staff-confirmed deterministic matching demand. **Ownership:** Association; free-text parsing returns an unsaved draft. **Trace:** FR-003 / FR-004 / FR-014.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Need identifier. |
| `association_id` | `uuid` | no | FK + UK → associations.id | none | Owner association. |
| `category` | `donation_category` | no | — | none | Supported category. Allowed values: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `attributes` | `jsonb` | no | — | {} | Validated matching attributes, e.g. size/product/size class. |
| `seasons` | `need_season[]` | yes | — | NULL | Explicit season policy vocabulary; NULL is unknown, never silently all seasons. Allowed values: `spring`, `summer`, `autumn`, `winter` (array elements). |
| `target_quantity` | `numeric(12,3)` | no | — | none | Positive human-confirmed target. |
| `unit` | `quantity_unit` | no | — | none | Must match the capacity and donation unit before approval. Allowed values: `item`. |
| `active` | `boolean` | no | — | true | Whether new matches can use this need. |
| `source_text` | `text` | yes | — | NULL | Optional original free-text need; staff-only scope. |
| `created_by` | `uuid` | no | FK → profiles.id | verified actor | Authorized confirming staff member. |
| `revision` | `bigint` | no | — | 1 | Positive write version. |
| `created_at` | `timestamptz` | no | — | now() | Confirmed need created at. |
| `updated_at` | `timestamptz` | no | — | now() | Last confirmed change. |

**Constraints and guards:** UNIQUE(id, association_id) supports same-association donation FK. Positive finite target; attributes is an object; unit nonempty. Matching attribute and season vocabularies await AMB-009/017. Commands cannot reduce target below committed demand or change category/unit on referenced commitments; inactive closes new matching only.

**Indexes:** (association_id, category, id) WHERE active for matching. (association_id, created_at DESC, id DESC) for staff cursor lists and complete association FK coverage. (created_by) for actor FK; UNIQUE(id, association_id) index.

### donations

Donor-owned working facts, current offer and human-controlled decision. **Ownership:** Donor owns facts; target association owns the human review action. **Trace:** FR-010 / FR-011 / FR-014–FR-017 / FR-023.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Donation aggregate identifier. |
| `donor_id` | `uuid` | no | FK → profiles.id | verified actor | Immutable donor ownership. |
| `association_id` | `uuid` | yes | FK + UK → associations.id | NULL | Current target only; one-target proposal DB-P02. |
| `need_id` | `uuid` | yes | FK → needs.id | NULL | Target need, same association; set with offer. |
| `category` | `donation_category` | yes | — | NULL | Current working category; NULL allowed before extraction/correction. Allowed values: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `attributes` | `jsonb` | no | — | {} | Current validated attributes, separate from immutable extracted JSON. |
| `quantity` | `numeric(12,3)` | yes | — | NULL | Positive explicit offer quantity; required before offering. |
| `unit` | `quantity_unit` | yes | — | NULL | Required before offering; no implicit conversion. Allowed values: `item`. |
| `basis_analysis_id` | `uuid` | yes | FK → donation_analysis.id | NULL | Original run that seeded current facts; same donation enforced. |
| `status` | `donation_status` | no | — | draft | draft, offered, approved, refused, booked, received, distributed. Allowed values: `draft`, `offered`, `approved`, `refused`, `booked`, `received`, `distributed`. |
| `decision` | `donation_decision` | yes | — | NULL | approved/refused only from authorized staff action. Allowed values: `approved`, `refused`. |
| `decided_by` | `uuid` | yes | FK → profiles.id | NULL | Human review actor; never a provider identity. |
| `decided_at` | `timestamptz` | yes | — | NULL | Human decision instant. |
| `intake_checks` | `jsonb` | yes | — | NULL | Staff assertions not_medicine and food_nonperishable_room_temperature; exact review policy remains AMB-007. |
| `offered_at` | `timestamptz` | yes | — | NULL | Offer submission instant. |
| `revision` | `bigint` | no | — | 1 | Positive aggregate version; correction/analysis seed/decision/booking/stock commands increment it. |
| `created_at` | `timestamptz` | no | — | now() | Draft created at. |
| `updated_at` | `timestamptz` | no | — | now() | Last aggregate transition. |

**Constraints and guards:** UNIQUE(id, association_id) supports scoped booking/movement FKs. Composite FK(need_id, association_id) → needs(id, association_id); both target fields are NULL in draft and non-NULL after offering. Composite FK(basis_analysis_id, id) → donation_analysis(id, donation_id); basis stays within this item. draft/offered have no decision actor/time/checks; refused requires decision=refused; approved/booked/received/distributed require decision=approved. Every decided row has actor/time/intake_checks. After draft, basis_analysis_id must be non-NULL. Before offering, command requires successful original analysis/photo evidence, category/quantity/unit and current eligibility. Draft has no offered_at. JSON fields must have expected object shape. Approval requires not_medicine=true and eligible food assertion when category=food; false assertions cannot be approved. Medicine/food clarification policy remains AMB-007. Direct owner/category/association/status/decision mutation is never granted; transitions and protected-column checks belong to commands.

**Indexes:** (donor_id, created_at DESC, id DESC) for My donations / RLS. (association_id, status, created_at DESC, id DESC) for queue, gallery and scoped reads. (need_id, status) WHERE need_id IS NOT NULL for demand sums and FK. (association_id, category, status) WHERE decision = 'approved' for occupancy scans. (basis_analysis_id) WHERE basis_analysis_id IS NOT NULL; (decided_by) WHERE decided_by IS NOT NULL for FK checks. UNIQUE(id, association_id) index for scoped child FKs.

### donation_photos

Supplement: validated photo metadata and immutable object references. **Ownership:** Donation owner and authorized target association read; trusted upload path writes. **Trace:** FR-007 / FR-009 / NFR-003.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Photo identifier used by analysis requests. |
| `donation_id` | `uuid` | no | FK → donations.id | none | Owning item. |
| `object_path` | `text` | no | UK | server-generated | Unique private-bucket path; no caller-selected URL. |
| `mime_type` | `text` | no | — | validated type | Validated content type, not blindly copied from header. |
| `size_bytes` | `bigint` | no | — | validated size | Positive validated byte count. |
| `sha256` | `text` | no | — | computed digest | 64 lowercase hex characters; binds evidence to bytes. |
| `kind` | `photo_kind` | no | — | none | item or label. Allowed values: `item`, `label`. |
| `uploaded_by` | `uuid` | no | FK → profiles.id | verified donor | Uploader must own the donation. |
| `created_at` | `timestamptz` | no | — | now() | Validated asset metadata created at. |

**Constraints and guards:** UNIQUE(object_path); positive bytes; valid digest; kind ∈ {item,label}. Bucket path/bytes are never overwritten in normal workflows. Upload limits/count remain AMB-003; unused failed-upload objects require eventual retention cleanup policy.

**Indexes:** (donation_id, created_at, id) for item photos and RLS join. (uploaded_by) for actor FK; object_path unique index.

### donation_analysis

Immutable original AI extraction and run provenance. **Ownership:** Donation-scoped read; server-only validated append. **Trace:** FR-008 / FR-009 / FR-011 / NFR-005 / NFR-008.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK + UK | generated UUID | Analysis run identifier. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | none | Item analyzed. |
| `provider` | `analysis_provider` | no | — | server config | openai, jev or hybrid; never selected by an untrusted result. Allowed values: `openai`, `jev`, `hybrid`. |
| `model` | `text` | no | — | server config | Actual model identifier from the selected provider configuration. |
| `category` | `donation_category` | no | — | validated output | Original AI category, never relabeled after a human override. Allowed values: `clothes`, `shoes`, `food`, `para`, `furniture`. |
| `extracted` | `jsonb` | no | — | validated output | Immutable original extracted facts, including printed date/type/PAO where present. |
| `confidence` | `numeric` | no | — | validated output | Finite estimate in [0,1]; proposed normalization DB-P06. |
| `input_photos` | `jsonb` | no | — | server snapshot | Array of photo_id + sha256 pairs, validated as belonging to this item; historical snapshot, not SQL FKs inside JSON. |
| `input_revision` | `bigint` | no | — | captured revision | Working aggregate revision when analysis input was captured. |
| `provenance` | `jsonb` | no | — | server metadata | Component provider/model attribution for hybrid extraction vs indicators; no credentials or provider-private payloads. |
| `created_at` | `timestamptz` | no | — | now() | Original run persisted at. |

**Constraints and guards:** UNIQUE(id, donation_id) for same-item basis FK. Supported provider/category; finite bounded confidence; extracted/provenance objects and input_photos nonempty array with checked metadata. No UPDATE/DELETE through product grants or commands; append result+indicators atomically. Failures do not become successful rows.

**Indexes:** (donation_id, created_at DESC, id DESC) for analysis history / RLS / FK. UNIQUE(id, donation_id) index.

### donation_indicators

Immutable original indicators with component attribution. **Ownership:** Inherits analysis → donation scope. **Trace:** BR-001; FR-009 / FR-011 / FR-026.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `analysis_id` | `uuid` | no | PK + FK → donation_analysis.id | none | Parent run in composite PK. |
| `key` | `text` | no | PK | validated output | Schema-defined indicator key; duplicate keys rejected. |
| `value` | `text` | yes | — | NULL | Optional extracted/observed indicator value. |
| `probability` | `numeric` | yes | — | NULL | Optional finite estimate in [0,1], not a decision. |
| `level` | `indicator_level` | yes | — | NULL | low, medium or high when present. Allowed values: `low`, `medium`, `high`. |
| `source_provider` | `indicator_provider` | no | — | server attribution | openai or jev component that supplied this indicator. Allowed values: `openai`, `jev`. |
| `source_model` | `text` | no | — | server attribution | Actual component model identifier. |

**Constraints and guards:** PK(analysis_id,key); probability NULL or finite in [0,1]; level NULL or low/medium/high. Optional value/probability/level may all be absent when schema permits unknown evidence; key vocabulary remains AMB-017. No product UPDATE/DELETE. Original indicator values survive corrections and decisions.

**Indexes:** PK covers analysis FK. Additional key/level filtering index only after query evidence justifies it; no blanket JSONB GIN index.

### expiry_info

Current typed source date facts; original extraction stays in analysis.extracted. **Ownership:** Donation owner edits in allowed stage; target members read. **Trace:** BR-002; FR-010 / FR-018–FR-020.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `donation_id` | `uuid` | no | PK + FK → donations.id | none | Zero or one current date-fact row per item. |
| `expiry_date` | `date` | yes | — | NULL | Exact printed/confirmed calendar date only; not a derived PAO date. |
| `date_type` | `expiry_date_type` | yes | — | NULL | DLC, DDM, expiry or PAO. Allowed values: `DLC`, `DDM`, `expiry`, `PAO`. |
| `pao_months` | `smallint` | yes | — | NULL | Positive printed/confirmed PAO months. |
| `date_precision` | `date_precision` | no | — | unknown | day, month, year or unknown; partial dates are not fabricated as exact dates. Allowed values: `day`, `month`, `year`, `unknown`. |
| `raw_label` | `text` | yes | — | NULL | Source label text when readable, including a partial date. |
| `readability` | `date_readability` | no | — | unknown | readable, unreadable or unknown; NULL date does not imply expired. Allowed values: `readable`, `unreadable`, `unknown`. |
| `opened_on` | `date` | yes | — | NULL | Optional human source fact for PAO; collection/applicability remains AMB-006. |
| `edited_by` | `uuid` | yes | FK → profiles.id | NULL | Human who last corrected date facts; NULL for original seeding. |
| `updated_at` | `timestamptz` | no | — | now() | Last source-fact update. |

**Constraints and guards:** PK/FK(donation_id); supported date_type/precision/readability; pao_months NULL or >0. expiry_date is non-NULL only with day precision; opened_on is a source fact, not a model-generated date. No days_left, expired, bucket, effective_pao_expiry, FEFO rank or stored expiry aggregate. Corrections also append donation_edits in the same transaction.

**Indexes:** PK covers donation FK; (edited_by) WHERE edited_by IS NOT NULL. (expiry_date, donation_id) WHERE expiry_date IS NOT NULL for source-date candidates; association authorization is still applied through donations.

### donation_edits

Supplement: append-only human correction history. **Ownership:** Donation-scoped evidence; human writes only through correction command. **Trace:** FR-010 / FR-011; NFR-005.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Correction event identifier. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | none | Corrected item. |
| `actor_id` | `uuid` | no | FK → profiles.id | verified actor | Current proposal allows the owning donor before offer. |
| `basis_analysis_id` | `uuid` | yes | FK → donation_analysis.id | NULL | AI run being compared at this correction; same-item composite guard. |
| `base_revision` | `bigint` | no | UK | expected revision | Donation revision before the edit. |
| `before_facts` | `jsonb` | no | — | server snapshot | Full prior working category/attributes/quantity/unit/expiry source facts. |
| `after_facts` | `jsonb` | no | — | server snapshot | Full resulting working facts; no original indicator mutation. |
| `created_at` | `timestamptz` | no | — | now() | Human correction recorded at. |

**Constraints and guards:** UNIQUE(donation_id,base_revision) for one correction per aggregate version. Composite FK(basis_analysis_id,donation_id) → donation_analysis(id,donation_id); snapshots are objects built by the server, not arbitrary audit text from clients. No product UPDATE/DELETE. Snapshotting is provenance of human source facts, not persisted derived expiry.

**Indexes:** (donation_id, created_at DESC, id DESC); (actor_id); (basis_analysis_id) WHERE basis_analysis_id IS NOT NULL. UNIQUE(donation_id,base_revision) index.

### slots

Configured drop-off appointments and booking ceilings. **Ownership:** Association; admin configuration proposal, members read. **Trace:** FR-006 / FR-023 / FR-025.

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

**Constraints and guards:** UNIQUE(id,association_id) for scoped booking FK; ends_at > starts_at; max_bookings >0. Under slot lock, ceiling cannot drop below committed bookings. Booked time/association changes are disallowed in the proposed profile; overlap/cancellation rules remain AMB-010.

**Indexes:** (association_id, starts_at, id) for availability / arrivals / FK. UNIQUE(id,association_id) index.

### bookings

One proposed booking per donation and signed QR reference material. **Ownership:** Donation owner and target-association personnel read; booking command writes. **Trace:** FR-023–FR-025; NFR-004.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Booking identifier. |
| `donation_id` | `uuid` | no | FK + UK → donations.id | none | Unique per donation under provisional one-booking profile. |
| `association_id` | `uuid` | no | FK → associations.id | none | Must match both donation and slot. |
| `slot_id` | `uuid` | no | FK → slots.id | none | Chosen target-association slot. |
| `qr_nonce` | `uuid` | no | — | generated UUID | Reference/version nonce, not a bearer secret; signing key stays server-only. |
| `qr_expires_at` | `timestamptz` | no | — | configured policy | Authoritative token validity deadline computed in code; lifetime policy remains AMB-013. |
| `created_at` | `timestamptz` | no | — | now() | Booking committed at. |

**Constraints and guards:** UNIQUE(donation_id); composite FK(donation_id,association_id) → donations(id,association_id); composite FK(slot_id,association_id) → slots(id,association_id). All scoped FK components are non-NULL. Expiry deadline must be after issuance; no invented token TTL. qr_nonce is not an authorization credential by itself. Insert only if donation decision is staff-approved and status permits booking; donation status and booking are committed together.

**Indexes:** UNIQUE(donation_id) index; (slot_id, id) for locked-slot count and FK. (association_id, created_at DESC, id DESC) for scope and association FK.

### inventory_movements

Actual receipt/distribution ledger, not pending-offer stock. **Ownership:** Target association; donors see their donation status, not the full ledger. **Trace:** FR-022 / FR-024 / FR-025.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Movement identifier. |
| `donation_id` | `uuid` | no | FK → donations.id | none | Source donation. |
| `association_id` | `uuid` | no | FK → associations.id | none | Same target association as the donation. |
| `movement_type` | `movement_kind` | no | — | none | receipt or distribution. Allowed values: `receipt`, `distribution`. |
| `quantity` | `numeric(12,3)` | no | — | none | Positive explicit quantity; sign determined by movement_type in code. |
| `unit` | `quantity_unit` | no | — | none | Same agreed unit as donation/need/capacity. Allowed values: `item`. |
| `actor_id` | `uuid` | no | FK → profiles.id | verified staff | Human recording the physical event. |
| `created_at` | `timestamptz` | no | — | now() | Physical event recorded at. |

**Constraints and guards:** Composite FK(donation_id,association_id) → donations(id,association_id); positive finite quantity; allowed movement_type. UNIQUE(donation_id) WHERE movement_type = 'receipt': one full receipt in proposed MVP profile. Distribution totals cannot exceed receipt; check under donation/capacity locks. Append-only product ledger; reversals/partial quantities remain open.

**Indexes:** (donation_id, created_at, id) for balance / FK. (association_id, created_at DESC, id DESC) for staff ledger / FK; (actor_id) for actor FK. Partial unique receipt index.

### api_requests

Supplement: private durable idempotency and external-call lease record. **Ownership:** Server-only private.api_requests; no browser grants or product read endpoint. **Trace:** NFR-004 / NFR-006; all mutation commands.

| Column | SQL type | Null? | Key / reference | Default / source | Meaning |
|---|---|---|---|---|---|
| `id` | `uuid` | no | PK | generated UUID | Internal request identifier. |
| `actor_id` | `uuid` | no | FK + UK → profiles.id | verified actor | Identity scope; never supplied as a trusted client field. |
| `operation` | `text` | no | UK | server route identity | Method + canonical resource path; prevents cross-endpoint key collisions. |
| `idempotency_key` | `uuid` | no | UK | request header | Caller retry key scoped to actor and operation. |
| `request_hash` | `text` | no | — | server digest | SHA-256 of canonical validated payload including expected_revision / relevant file digest. |
| `state` | `request_state` | no | — | in_progress | in_progress or completed. Allowed values: `in_progress`, `completed`. |
| `attempt_id` | `uuid` | no | — | generated UUID | Lease owner/fencing token for external-call completion. |
| `lease_until` | `timestamptz` | yes | — | configured timeout | Required for in-progress external operations; no transaction held during provider calls. |
| `resource_id` | `uuid` | yes | — | NULL | Result reference; polymorphic metadata, deliberately not a SQL FK. |
| `http_status` | `smallint` | yes | — | NULL | Original successful HTTP status once completed. |
| `result_refs` | `jsonb` | yes | — | NULL | Stable resource/event references and action outcome only; no computed expiry/balances, QR payload, signed URL, credentials or raw bytes. |
| `created_at` | `timestamptz` | no | — | now() | Retry claim created at. |

**Constraints and guards:** UNIQUE(actor_id,operation,idempotency_key); valid 64-hex hash. Completed records have successful http_status and a command-allowlisted result_refs object; resource_id may be NULL for composite-key results such as capacity. result_refs stores resource/event identifiers (or association/category key) and historical action outcomes, never a literal HTTP response snapshot. Only the current attempt_id can finalize; same-key different body is conflict. Replay must reauthorize current access first. Retention/lease duration require AMB-015/019.

**Indexes:** Unique retry-scope index covers actor FK prefix. (lease_until) WHERE state = 'in_progress' for bounded recovery inspection; no cron/queue is required in the MVP.

## What attributes means

`donations.attributes` is the current validated set of category-specific **item facts**: for example, clothes may have `type=jacket`, `size=M`, `season=winter`; shoes may have `type=sneakers` and `size=40`. `needs.attributes` contains the corresponding staff-confirmed matching criteria. The exact permitted keys/types are category- and context-specific under AMB-017; unknown facts remain unknown. Neither field is an arbitrary JSON dumping ground.

Keep the name `attributes`: these values directly affect matching and review. `metadata` would blur them with technical provenance such as provider/model/photo digests. Original AI facts remain in `donation_analysis.extracted`; donor edits change only working facts and append `donation_edits`. Typed current date facts belong in `expiry_info`, quantities/units in dedicated columns; do not add competing copies inside attributes. Indicators/confidence/status/ownership cannot be written through this JSON object.

## Relationship cardinality and scope constraints

Read each child FK as exactly one parent when non-NULL and zero or one parent when nullable. A parent may have zero children unless explicitly noted; no account must have a donation and no association must have a need/slot yet.

| Parent → child | Cardinality | Scope / role |
|---|---|---|
| `auth.users` → `profiles` | 1 → 0..1 | Shared PK/FK identity; an application profile is required for product commands. |
| `profiles` → `association_members` ← `associations` | Each 1 → 0..N; profiles ↔ associations is M:N | Composite PK prevents duplicate current memberships. |
| `profiles` → `associations` | 1 → 0..N per role | `registered_by` mandatory; `approved_by` optional. Approval actor is independently checked as platform admin. |
| `associations` → `capacity`, `needs`, `slots` | Each 1 → 0..N | One capacity row per category; all rows belong to the association. |
| `profiles` → `needs`, `donation_photos`, `donation_edits`, `inventory_movements`, `api_requests` | Each 1 → 0..N | Creation/upload/edit/event/request actor; actor references never imply permission by themselves. |
| `profiles` → `donations` | 1 → 0..N | Mandatory donor; optional separate `decided_by` role. |
| `associations` / `needs` → `donations` | Each 1 → 0..N; donation has 0..1 target before offer, exactly 1 after | `(need_id,association_id)` ties the selected need to the target association. Need category/unit are revalidated under lock. |
| `donations` → `donation_photos`, `donation_analysis`, `donation_edits` | Each 1 → 0..N | Child rows inherit donation read scope. Photo snapshots in original runs preserve exact input IDs/digests. |
| `donation_analysis` → `donation_indicators` | 1 → 0..N | Composite PK `(analysis_id,key)`; one original value per key in a run. |
| `donation_analysis` → donation working basis / correction basis | 1 → 0..N; each basis optional | Composite FK includes donation ID, so no evidence from a different donor/item can be attached. |
| `donations` → `expiry_info` | 1 → 0..1 | Shared PK/FK current typed source facts. Original date extraction remains immutable in `donation_analysis.extracted`. `edited_by` optionally references one profile. |
| `donations` → `bookings` | 1 → 0..1 | Provisional one-booking UK. Booking's association must equal the donation's association. |
| `slots` → `bookings` | 1 → 0..N | Each booking has exactly one slot in that same association. Number of children constrained transactionally by `max_bookings`. |
| `associations` → `bookings` / `inventory_movements` | Each 1 → 0..N | Direct association FK plus scoped donation/slot FKs prevent cross-association attachment. |
| `donations` → `inventory_movements` | 1 → 0..N | At most one receipt under DB-P02; distribution total bounded by received quantity. |
| `redirect_points` | Independent shared references | No association, transport reservation, external message or donor relationship is stored. |

Composite constraints are important even when identifiers are globally unique: a row may otherwise carry a valid donation ID from X and a valid association ID from Y. Supporting UKs are `needs(id,association_id)`, `donations(id,association_id)`, `slots(id,association_id)` and `donation_analysis(id,donation_id)`. The per-column FK references in the ERD describe the referenced key roles; these multi-column constraints additionally enforce the same item/tenant. Composite FK columns used by bookings/movements are all non-NULL. The optional analysis basis uses a nullable analysis ID while the donation ID is always present.

Cross-row facts such as current membership, target eligibility, sum of booked places or inventory balance are **not CHECK constraints**: commands validate them while holding locks. PostgreSQL documents that CHECK constraints cannot safely express arbitrary other-row state; FK/UK and transaction guards address different classes of invariant. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

## RLS, grants and write capabilities

The SELECT predicates below are policy specifications, not executable policy definitions. `U` means the verified Supabase subject `(select auth.uid())`, `Own(d)` means `d.donor_id=U`, and `Member(a)` means an **active** `association_members` row for `U` and `a`. `Admin(a)` additionally requires `assoc_admin`. `Platform(U)` reads the protected profile platform role, never editable `user_metadata`.

`ReadDonation(d) = Own(d) OR Member(d.association_id)`. A draft with no target has no member branch. Platform status alone adds no donation/analysis/photo/booking/stock visibility. Membership predicates inspect the caller's own rows; the membership SELECT policy itself is simply `profile_id=U`, avoiding recursive membership-policy joins. Unauthenticated subjects fail every product predicate.

| Entity | `authenticated` SELECT predicate / projection | Product write authority |
|---|---|---|
| `profiles` | `id=U` | Own display name via command only; platform role/provisioning never a self-edit. |
| `associations` | `Member(id) OR registered_by=U OR Platform(U)` | Applicant registration command; own admin configuration command; separate platform approval command. Donor matching/booking listing is a restricted server projection, not a broad table policy. |
| `association_members` | `profile_id=U` | Trusted provisioning only until AMB-001/002; no self-join or arbitrary membership endpoint. |
| `capacity`, `needs`, `slots` | `Member(association_id)` | Admin configuration commands in DB-P01; staff management rights remain open. Donor slot availability uses a guarded projection for an approved own offer. |
| `donations` | `ReadDonation(row)` | Own pre-offer facts through correction command; offer/book commands for owner; decision/reception/distribution for target members. Protected columns never generic patch fields. |
| `donation_photos`, `donation_analysis`, `donation_edits`, `expiry_info` | Exists parent donation satisfying `ReadDonation` | Trusted validated photo/analysis append; own allowed correction appends edits + changes current facts/date row atomically. No original-result update/delete. |
| `donation_indicators` | Parent analysis → donation satisfies `ReadDonation` | Trusted server append with original run only; no product update/delete. |
| `bookings` | Parent donation satisfies `ReadDonation`; scoped FKs agree | Owner booking command; no generic booking update/delete or raw QR signing material endpoint. |
| `inventory_movements` | `Member(association_id)` | Target-member event commands; donor reads resulting donation status instead of the full ledger. |
| `redirect_points` | `active=true` | Seed/provisioning only, not a new platform admin privilege. |
| `private.api_requests` | No client SELECT policy/grant | Internal command retry mechanism only; reauthorize before any response replay. |

All client INSERT/UPDATE/DELETE grants and policies are denied. Row visibility is insufficient to protect different columns of one donation: use explicit command signatures, protected-column checks and immutable evidence/ledger guards. The proposed transaction entry points are small invoker wrappers delegating to audited functions in a **non-exposed private schema** when privileged writes are necessary. Authenticated user commands derive their actor from `auth.uid()`; reject NULL, then check role, ownership, allowed stage, expected revision and field allowlists. Public wrappers themselves use SECURITY INVOKER. Revoke default function EXECUTE and grant only the intended entry points. There is no arbitrary SQL or arbitrary table-update command.

Private SECURITY DEFINER command bodies intentionally perform privileged writes and therefore must repeat the authorization predicates and protected-column guards; RLS alone does not validate those writes. Pin `search_path`, schema-qualify objects, and use the smallest audited owner privileges. The analysis/upload persistence and QR-confirmed reception commands are server-only capabilities: no authenticated caller may fabricate a provider result, file-validation assertion or server-validated QR proof by invoking an RPC directly. Their server credential is never passed to a browser; the FastAPI handler verifies the caller and the restricted command checks the supplied verified actor against ownership/membership again. Ordinary reads preserve the user JWT and RLS. Privileged matching/listing/QR reads return explicit DTO allowlists, never `SELECT *` results to a donor.

An immutable-row guard must also protect original analysis/indicators, accepted photo objects, edits and stock events from accidental application UPDATE/DELETE with a privileged credential. A future retention operation is separate from ordinary product mutation. If a later design allows direct UPDATE, it needs column grants, a compatible SELECT policy, and both old-row USING and new-row WITH CHECK predicates so ownership/association cannot be reassigned. Supabase separates object grants from row policies and cautions about privileged functions/views; exposed read views must preserve invoker security. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Photo storage

Use a private donation-photo bucket with server-generated paths bound to donor/donation/photo IDs. Type/byte limits and actual content validation precede provider calls and trusted metadata insertion. No public bucket, arbitrary URL ingestion or normal upsert over evidence objects. Storage and Postgres are not one transaction: stage valid bytes, commit metadata only after a successful upload, and leave failed/unreferenced objects outside analysis until the retention cleanup policy is defined. Retry keys and immutable paths prevent replacing analyzed bytes.

Photo content reads are authorized through the item's current owner/target membership and streamed by the FastAPI handler. Storage policies, when direct object access is enabled, must mirror that scope and cannot rely on an unverified path prefix. This proposal grants no client Storage writes. Short-lived signed URL delivery could be added later only with an agreed lifetime; examples do not persist such URLs in the database or retry cache. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

### Why photos use Storage instead of base64 database text

The retained design stores validated **image bytes in a private Supabase Storage bucket**, and stores object references, MIME type, byte count, SHA-256 and ownership-linked metadata in `donation_photos`. The FastAPI content endpoint authorizes and streams the bytes. This is already the product's planned file-storage service; base64 is an encoding, not a persistence requirement. [Supabase file storage](https://supabase.com/docs/guides/storage)

Base64 uses four encoded characters per three input bytes (approximately 33% extra before envelope overhead), so persisting base64 text enlarges image payloads and pushes them into database reads/backups. That ratio follows the encoding specification; it is not a measured Dono benchmark. If database-only storage is later explicitly selected, prefer a separate `bytea` blob table over base64 text, then revise the ERD, authorization, size limits and backup/serving plan. Temporary base64 in a provider request, when its contract needs it, does not imply saving base64 in Postgres. No database-only switch is made on the basis of this design question. [Base64 specification](https://datatracker.ietf.org/doc/html/rfc4648#section-4), [PostgreSQL binary values](https://www.postgresql.org/docs/current/datatype-binary.html)

## Atomic transactions and concurrency

Use a **single PostgreSQL transaction per business command**, through one database function invocation or one checked-out connection. Several awaited Supabase REST calls are not a transaction. Do not hold locks across OpenAI, geocoding, file upload or QR rendering. External results are validated outside the critical section, then committed with current identity/state/input checks. [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html)

The proposed MVP uses a deliberately simple association mutex, trading some write throughput for clear correctness. After claiming the idempotency row, lock the actor profile and needed membership for share (profile edits take the profile update lock immediately), then acquire applicable rows in this global order: association → category capacity (sorted category) → need (sorted ID) → slot (sorted ID) → donation (sorted ID) → booking → dependent evidence/movements. Use an exclusive association-row lock for every intake/capacity/slot/stock mutation for that association; all writers use this protocol. Draft-only commands with no association lock only their donation before its children. Read related IDs first, then recheck them under lock; if they changed, abort/retry rather than acquiring a new parent out of order. Membership revocation/provisioning must follow a compatible profile/membership lock order.

Under READ COMMITTED, calculate aggregates in fresh statements **after** obtaining the parent mutex. All writers must participate; the lock on an existing parent protects even an empty child set from two concurrent inserts. Do not lock only currently existing bookings or use an unlocked read-then-insert test. Resource revisions prevent stale configuration/working-fact overwrites; the mutex and current aggregates prevent oversubscription. Set bounded transaction timeouts and retry deadlock/serialization failures with the same idempotency key; numeric operational limits remain AMB-019.

### Capacity and need accounting under DB-P04

For one association/category/unit, compute `reserved` as quantities of staff-approved donations whose status is approved/booked, and `in_stock` as recorded receipt quantities minus distribution quantities. `occupied = reserved + in_stock`; `available = limit_quantity - occupied`. No occupied/free/reserved counter is stored. A committed transition must preserve `0 ≤ occupied ≤ limit_quantity` and equal units.

For a need, `pending_hold` is approved/booked quantity and `fulfilled` is actual receipts against that need. `need_available = target_quantity - pending_hold - fulfilled`. Distribution does not subtract from fulfilled. Reducing a limit/target below commitments fails; views must not hide a broken invariant by silently clamping a negative balance. This accounting is a **proposal pending AMB-008**, not a resolution of when associations want to count demand.

| Command | Checks under locks | Atomic effect / race behavior |
|---|---|---|
| Correct working facts | Owner; allowed pre-offer stage; expected revision; schema/quantity/date validation | Update working donation + expiry facts; append server-built before/after edit; increment donation revision. Original run/indicators remain unchanged. |
| Persist analysis | Server capability; immutable validated photo snapshot; owner/item linkage; captured revision | Append original run + indicators together. Seed working facts only for the first basis when its captured revision is still current and no human correction is overwritten; otherwise return evidence without replacing current facts. Competing first analyses seed at most once. |
| Offer | Owner; expected revision; approved association; successful original analysis/photo evidence; current need/category/unit/season eligibility; positive available capacity/demand | Bind the one proposed target and mark offered. Offered items do not reserve capacity in DB-P04; they may later face a staff-review conflict. |
| Staff decision | Target active membership; offered state/revision; current intake assertions. Approval additionally requires approved association, active matching need, current category/unit/season eligibility and quantity fitting available capacity/demand under locks | Save explicit human decision/actor/time/checks. Approval adds one logical hold through status transition; refusal adds none and does not require a successful match. Two competing approvals serialize on the parent row. |
| Capacity/need configuration | Own admin; expected revision; units; current commitments | Limit/target can never shrink below commitments. No unit/category change while commitments reference it. |
| Book | Owner; staff-approved current donation/revision; correct association; active future slot and hours policy | Lock slot; count **all committed bookings in that slot**, including received ones, against max_bookings. Insert booking + change donation to booked in one commit. Last place can be claimed once; UK(donation_id) prevents a second booking. Capacity hold is unchanged. |
| Resolve QR | Authenticated target member; signature/nonce/deadline/association | Read-only resolution. Produces no decision, receipt or stock. QR signing/verification is deterministic code using a separate server-only signing key. |
| Confirm reception | Server validates signed QR; command repeats target membership, nonce/deadline, booked state and expected revision | Insert one full receipt, change donation to received and complete retry record together. Reserved quantity becomes received stock with no net capacity increase; pending need hold becomes fulfilled. Partial unique receipt index is a second duplicate barrier. |
| Distribute | Target member; received stock; expected revision; valid quantity/unit; agreed partial policy | Append distribution and update lifecycle once. Sum cannot exceed received quantity; full distribution sets distributed. Capacity releases by recorded quantity, fulfilled demand does not reopen. |

Invalid/foreign QR attempts do not write state. An already-received replay preserves the first receipt actor/time, not a new staff attribution. New actions with stale revisions return a conflict. No automatic donation acceptance, expiry refusal or medicine override exists. Booking cancellation, no-show release, re-offering and reversals require separate lifecycle/policy changes before any release logic is added.

### Durable retries and external-call fencing

`private.api_requests` uniquely claims `(actor_id,operation,idempotency_key)` with a hash of canonical validated input. Commands compute/verify that hash against their actual parameters; a caller-supplied digest is not trusted. Matching completed requests return the original success status and the same resource/event identity **after current authorization**, rebuilding mutable DTOs and all read-time derivatives from current authorized facts; a reused key with a different payload is a conflict. A duplicate in-progress request returns conflict/retry guidance. Successful business writes and retry completion commit together. Validation/authorization failures before a claim are not cached. Retention of keys is an unresolved operational policy; do not promise indefinite replay or delete keys silently during the documented guarantee window.

For photo/analysis calls, claim a configured lease and attempt ID in a short transaction, release the connection, then perform the external operation. Only the current attempt ID can commit results; expired-lease recovery uses compare-and-swap fencing. A timeout may repeat an external provider call, but cannot create duplicate logical effects or overwrite evidence. Do not promise exactly-once provider billing. The retry ledger stores outcome references rather than HTTP response snapshots; it excludes every derived expiry/mismatch/balance/count field, credentials, QR payloads and signed URLs; GET QR reconstructs a signed reference from the current booking instead. No queue/cron service is required by this design.

The [pre-implementation audit](handoff.md#consistency-audit) leaves basis adoption after a first-analysis/edit race open under AMB-004: a successful immutable result can exist without seeded working facts, while offers require a retained basis. Resolve a recovery/adoption rule that preserves human facts before implementing that command; do not silently populate the basis from arbitrary historical evidence. The same audit records that request-scoped donor locations cannot support later origin/radius revalidation unless the agreed policy changes the protected source schema (AMB-009/016).

## Read-time expiry and deterministic matching

Original AI date facts stay in `donation_analysis.extracted`; current validated source facts stay in `expiry_info` and edit snapshots. On reads, Python expiry code resolves the agreed calendar/timezone, date precision and PAO applicability, then computes days left, expired flag, buckets and FEFO. Compute all totals/counts/distances in deterministic code/queries. Never ask a model to calculate a shelf-life statistic or persist a bucket, flag, rank, days-left value, average shelf life or effective PAO-derived expiry.

Until AMB-005/006/011 is resolved, source facts remain readable and uncertain derivatives remain NULL with a policy/unknown reason. Required MVP bucket/FEFO behavior is not considered complete until the missing rules are agreed and tested. Exactly 90 days is not silently assigned; unreadable is not “expired”; PAO without an applicable source opening date is not an inferred date. FEFO includes received undistributed stock only, with agreed unknown-date ordering and stable donation-ID ties. Cursors for derived lists carry the reference-date/policy context and expire when that context changes.

Matching reads approved association configuration and validated working facts, computes need/capacity/season eligibility plus Haversine distance, and returns a limited association DTO. It invokes no model. Distance and match scores are not stored as donation facts; offer/decision commands recheck current eligibility. No PostGIS, vector search, vehicle routing or transport table is needed for this MVP.

## Verification and external documentation

Before implementation, resolve the provisional choices above, finalize SQL constraint/grant/function definitions and select the project's migration workflow. No SQL was executed for this task. Future checks must include two donors/two associations, direct Data API and Storage attempts, role escalation and protected-field mutations, foreign-tenant FK attempts, competing last-capacity approvals/last-slot bookings, duplicate reception, excessive distribution, analysis failure/retry fencing and evidence preservation. Then run the AGENTS.md app checks and 25–35-photo evaluation; an ERD pass is not a database/RLS test.

The Supabase changelog was consulted on 2026-10-24. The relevant table-exposure change makes explicit grants part of provisioning; neither old implicit defaults nor RLS alone should be assumed to expose/protect a new table. No dependencies, extensions, schemas or remote project settings were changed. [Supabase table-exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

The [current ERD summary](architecture/validation/fastapi-v1/database-erd.finalize-summary.json) records passing validation, delivery, strict artifact/provenance and Chrome gates. The [full receipt](architecture/validation/fastapi-v1/database-erd.finalize.json) records zero structural errors and 25 dense-layout warnings (24 relationship crossings, one static legacy-width readability warning). The browser preserves readable field text through page scrolling. This is a full-field `standard` ERD, not a warning-free showcase claim; all 153 application columns and 30 FK roles remain visible. [Architecture.md](architecture.md#validation-evidence) links the current captures and limitations. Regenerate with the installed Archify finalizer, keeping evidence for changed candidates in a fresh directory. No live database/RLS tests were run because no database objects were implemented.
