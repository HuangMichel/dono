# Dono architecture

This document describes the system design. The frontend and backend are implemented in this checkout; [readiness](readiness.md) records verification and deployment limits. [AGENTS.md](../AGENTS.md) retains authority. The [domain model](domain-model.md) defines the working DEC profile used by [requirements](requirements.md), [features/use cases](features.md), [database/RLS](databases.md) and the [FastAPI contract](api.md). The six domain review findings are addressed structurally; [handoff](handoff.md) records remaining product decisions.

## Interactive diagrams

Each standalone HTML has themes, focus/search and export controls. The original editable JSON sources are absent from this checkout. Diagram labels are English and visually follow the existing Archify example. Ten diagrams separate the four aggregates instead of presenting one combined donation/offer/booking/stock status.

| Diagram | Interactive HTML | Source | Trace |
|---|---|---|---|
| System | [System architecture](architecture/dono-architecture.html) | `candidate.json` (unavailable) | BR-001–BR-006; NFR-001/002 |
| Actors and boundary | [UML-style use cases](architecture/use-cases.html) | `use-cases.json` (unavailable) | UC-001–UC-012, UC-015/016; optional UC-013/014 in notes |
| Creation and delayed evidence | [Photo / human facts / AI](architecture/donation-creation.html) | `donation-creation.json` (unavailable) | FR-007–FR-011, FR-038; UC-003–UC-005 |
| Match and human decision | [Matching / review](architecture/matching-review.html) | `matching-review.json` (unavailable) | FR-013–FR-017, FR-033/034; UC-006–UC-008 |
| Booking, QR and recovery | [Booking / reception](architecture/booking-reception.html) | `booking-reception.json` (unavailable) | FR-023/024/035/036; UC-010/011/015 |
| Reusable item | [Donation lifecycle](architecture/donation-lifecycle.html) | `donation-lifecycle.json` (unavailable) | FR-033/036; UC-007/015 |
| Recipient attempt | [Offer lifecycle](architecture/offer-lifecycle.html) | `offer-lifecycle.json` (unavailable) | FR-017/033/035/036; UC-008/015 |
| Appointment | [Booking lifecycle](architecture/booking-lifecycle.html) | `booking-lifecycle.json` (unavailable) | FR-023/024/035/036; UC-010/011/015 |
| Physical stock | [Inventory lifecycle](architecture/inventory-lifecycle.html) | `inventory-lifecycle.json` (unavailable) | FR-022/034/036; UC-011/012 |
| Relational data | [Full database ERD](architecture/database-erd.html) | `database-erd.json` (unavailable) | All 21 application tables; FR-033–FR-038; NFR-001/004/005 |

Use-case boxes are UML-style responsibilities inside a system boundary, not native UML ellipses or deployable services. Repeated actor appearances denote the same role. Sequences show alternatives explicitly: cancellation/no-show is an alternative **before** reception, never a later cancellation of received stock. Lifecycle diagrams use native Archify v3 states; inventory states are derived labels, not a stored enum/table column.

The archived system and use-case diagrams still label authentication as Google OAuth. The current authentication contract is email/password in [DEC-008](domain-model.md#working-defaults); the diagram JSON sources are absent in this checkout, so these historical exports were not regenerated.

## Components and trust boundaries

Next.js renders donor, association and platform views, establishes Supabase sessions and sends bearer access tokens to FastAPI. It never receives provider/elevated/QR secrets and does not duplicate business APIs in Route Handlers or server actions. FastAPI verifies JWTs, resolves current enabled profiles/memberships, validates files and DTOs, orchestrates restricted database commands and calls OpenAI/BAN outside transactions. Use one Python runtime with thin routers and shared domain functions; no ORM, queue or worker fleet is necessary for this MVP.

Supabase Auth uses email/password signup and sign-in. Account confirmation is optional in hosted settings; donation notification emails and invitations remain outside scope. Postgres owns typed source data, history, scoped RLS and concurrency constraints. Postgres persists validated image base64 in private.photo_contents and immutable metadata/digests in donation_photos, atomically. There is no Supabase Storage service or bucket. The two database nodes in the system diagram show logical data groups in the same Postgres database. Photo content is fetched through an authenticated endpoint with fresh owner/offer-evidence scope checks, decoded to binary, and verified against size/digest. Lists never join private payloads. BAN address search uses IGN Géoplateforme, https://data.geopf.fr/geocodage/; Haversine calculation remains Python code. Jev probabilities are optional and never replace OpenAI extraction.

Ordinary database reads carry the user JWT and RLS. Business commands use restricted server-only capabilities with current actor/tenant/state checks inside the transaction. Merely using a service credential does not enforce permissions. RLS helper recursion, grants, fixed search paths and exposure of command wrappers are specified in [databases.md](databases.md#rls-grants-and-write-capabilities). Policies and guarded commands exist in [the migrations](../supabase/migrations/). See [readiness](readiness.md) for database checks and remaining hosted permission checks.

## Domain ownership and history

The 21-table model adds donation_offers, offer_events, intake_quotas, membership_events and private.photo_contents to the previous 16-table proposal. Donation is the reusable donor-owned item. Offer is a recipient-specific attempt with frozen source facts, permitted evidence IDs, human decision and finite deadlines. Booking belongs to that attempt. Inventory movements describe actual full receipt/distribution, independent from all three stored lifecycle enums.

A partial unique index permits at most one pending_review/approved offer per donation. Before replacement, materialize due rows under locks. Refusal/cancellation/timeout ends that attempt; a ready item can be corrected and re-offered using the same donation ID. Closed attempts and decisions remain history. One booking per offer permits many historical bookings per item. Cross-attempt uniqueness allows one actual full receipt/distribution per donation. No partials, reversals, post-receipt returns or in-place rescheduling in the baseline.

The offer_events journal records actor/reason/revision and effective cutoff versus recorded time. donation_edits records source facts and disposition changes; membership_events records provisioning/grants/transfer/revocation/recovery. These are small domain histories, not a generic event-sourcing framework.

## Evidence, corrections and delayed results

Successful donation_analysis and donation_indicators records are immutable originals: provider/model, original category/extraction, confidence and input photo/request provenance. Current donor category/attributes/source dates and facts_revision are separate. The original indicator category remains visible after an override; mismatch is a computed display fact.

Analysis captures request/photo/facts-version context before external HTTP. It may finish after a concurrent human edit/publication/offer. Its fenced commit appends originals once and attaches a missing comparison basis independently. It may seed current fields only when they are still empty, facts_revision matches and no active offer exists. Human initial input and corrections always win. New analysis requests/item edits are frozen during an active offer, but already-captured requests may complete.

A complete human item with valid photos can publish/be offered without a successful result or basis. Pending/unavailable evidence is explicit; approving personnel must acknowledge manual review plus medicine/food intake assertions. No confidence, analysis success or safety clearance is fabricated. Threshold and ambiguous-evidence handling follow [analysis-v1](analysis-rules.md); confirmed medicines and chilled/frozen individual food remain excluded.

Offer submission freezes facts/source dates and photo/request/edit ID whitelist. Staff read this snapshot and only those originals, including late completion of a request already in scope. They cannot read raw current donations/expiry_info or new corrections/analysis requested for a subsequent association. A late warning is highlighted in-app; it never retroactively changes a human decision or resources. A new authorized human action can cancel an unreceived attempt.

## Independent budgets, finite leases and transactions

Need demand is requested item quantity. Storage is an integer place ceiling, using the staff-declared storage_units_per_item rate frozen at approval. Intake quota limits category/day item throughput. Slot capacity limits appointment count. Matching checks all independently plus need/category/attributes/season; orders by Haversine distance and stable IDs; makes no model call or reservation. The read-time formulas and exact release matrix are in [domain-model.md](domain-model.md#independent-accounting-and-matching).

Approval holds demand/storage for 24 hours; review expires after 72 hours without a hold. Booking must select a future start within seven days, adds dated quota/place and substitutes a bounded receipt cutoff at slot end +30 minutes. Receipt is valid in [slot start, cutoff). At equality, code expires the offer and marks booking no_show. Cancellation/withdrawal/no-show releases all unreceived holds. Receipt converts them to fulfilled demand, consumed quota and physical stock; distribution later releases storage only.

Reads ignore elapsed holds immediately, even without cleanup. Store no now()-dependent uniqueness predicate. A bounded authenticated reconciliation command and normal successful mutations materialize terminal states/events using the same guards. No cron is required for correctness. Retry keys, request fencing, expected revisions, common parent lock order and same-tenant composite FKs protect races; configuration reductions cannot undercut commitments. Provider HTTP never holds row locks. See the [transaction protocol](databases.md#atomic-transactions-and-concurrency).

## Registration, membership and revocation

Bootstrap a donor-only application profile from the verified Auth subject. Association registration creates pending entity + original applicant inactive admin + event atomically. Platform manual approval activates that exact applicant in the same transaction. Pending status grants no intake/offer visibility. Normalize/uniquely constrain at least one RNA/SIRET; one legal entity/site in MVP.

Only active association admins configure intake/members; admin/staff both review/receive/distribute. Grants use existing enabled profile UUIDs, without email invitations or directory lookup. Last-enabled-admin protection and atomic transfer prevent orphaning. Changes append audit events; after revocation commits, stale JWTs and retries grant no membership. Limited platform orphan recovery is allowed only with no enabled active admin and reactivates the original applicant after manual verification/reason; it grants no donation access.

## Expiry and 40-hour boundaries

Store source expiry_date/date_type/pao_months, raw label/precision/readability and optional human opened_on. Python computes effective PAO date, days left, expired, buckets and FEFO at read time from current owner or frozen offered facts. No derivatives in database rows, audit snapshots or retry responses. [Expiry-v1](expiry-rules.md) fixes exclusive boundaries (including today/exactly 90), partial/ambiguous dates, calendar PAO, DLC/DDM checks and total FEFO order. [Analysis-v1](analysis-rules.md) fixes all five category contracts and uncertainty semantics. These policies are separate from operational lease defaults.

Basic gallery/counts/FEFO use received undistributed lots only. Review offers remain separate. Reuse one item/evidence view and simple forms/lists; all five category schemas remain required. Cut Jev → comparison → timeline → agreement if needed. Never cut indicators, expiry buckets/distribute-first, review queue, QR reception or auth/RLS. Transport, routing, donation notification emails, and messaging are outside scope. Account confirmation emails are allowed.

## Validation evidence

Earlier delivery notes reported successful Archify and browser checks for ten diagrams. The machine-readable validation receipts and editable JSON sources are absent from this checkout, so those results cannot be verified from the available files.

The retained capture pages are historical evidence for their original diagram versions:

| Diagram | Capture page |
|---|---|
| System | [Captures](architecture/validation/base64-visual/dono-architecture.visual-check.html) |
| Use cases | [Captures](architecture/validation/base64-visual/use-cases.visual-check.html) |
| Donation creation | [Captures](architecture/validation/base64-visual/donation-creation.visual-check.html) |
| Matching and review | [Captures](architecture/validation/domain-visual/matching-review.visual-check.html) |
| Booking and reception | [Captures](architecture/validation/domain-visual/booking-reception.visual-check.html) |
| Donation lifecycle | [Captures](architecture/validation/domain-visual/donation-lifecycle.visual-check.html) |
| Offer lifecycle | [Captures](architecture/validation/domain-visual/offer-lifecycle.visual-check.html) |
| Booking lifecycle | [Captures](architecture/validation/domain-visual/booking-lifecycle.visual-check.html) |
| Inventory lifecycle | [Captures](architecture/validation/domain-visual/inventory-lifecycle.visual-check.html) |
| Database ERD | [Captures](architecture/validation/base64-visual/database-erd.visual-check.html) |

The earlier ERD report recorded 61 composition warnings, including 60 relationship crossings and one desktop-readability warning. Other recorded advisories concerned routed detours and an offer-lifecycle crossover. Long diagrams scroll vertically. Diagram checks do not establish API, RLS, transaction, or deployment correctness.

## Regeneration

Restore the editable JSON sources and confirm the local Archify installation before regeneration. The command below cannot run with the files currently available. Use the exact diagram type from each restored source. The available local Node binary may differ from PATH; no project package scripts exist. From the repository root, the command form is:

```sh
node .agents/skills/archify/bin/archify.mjs finalize lifecycle docs/architecture/offer-lifecycle.json docs/architecture/offer-lifecycle.html --quality showcase --out-dir docs/architecture/validation/domain-next --json
```

Use architecture for candidate/use-cases, sequence for the three sequences, lifecycle for the four state graphs and erd with standard quality for the full-schema ERD. Run each delivery sequentially in a shared output directory. A revision after browser evidence requires a fresh evidence directory; never hand-edit generated HTML. Retain native source/current delivery/finalize/browser receipts; screenshots are additional evidence and require inspection before claiming visual review.

## Analysis and expiry rules

The analysis and expiry contracts are specified in [analysis-v1](analysis-rules.md), [expiry-v1](expiry-rules.md) and [rule test cases](rules-test-cases.md). Schemas are closed JSON contracts within existing extracted/attributes/provenance fields. Category confidence is not global OCR/acceptability confidence; nulls, conflicts and original provenance are explicit. Manual fallback remains the same donor/staff workflow.

FastAPI calculates item-expiry views/guards in Python. The existing restricted atomic command rechecks unchanged sources/evidence and the reference-day UTC clock fence, so a calculation made before midnight cannot commit afterward. It does not compute item expiry in SQL or persist the result. Physical commands retain the same actors/routes/states; date-specific acknowledgements/reason refine their existing guards.

The diagrams were not regenerated for the analysis and expiry refinement. Current application test evidence is recorded in [readiness](readiness.md).

## Backend implementation status

The architecture is now backed by [FastAPI composition](../backend/app/main.py), explicit [REST response contracts](../backend/app/api/responses.py), pure [expiry](../backend/app/domain/expiry.py) and [matching](../backend/app/domain/matching.py), [OpenAI](../backend/app/adapters/openai.py)/[BAN](../backend/app/adapters/geocoding.py) adapters, and [PostgreSQL migrations](../supabase/migrations/). Ordinary reads use bearer-scoped RLS; privileged projections and commands reauthorize inside restricted functions owned by a dedicated application role.

The [Next.js frontend](../frontend/README.md) calls FastAPI for business operations. Supabase Storage, transport, messaging, queues, and workers remain outside the architecture. Current runtime evidence is in [readiness](readiness.md).
