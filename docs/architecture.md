# Dono architecture

Status: **corrected design specification, not a running application**. [AGENTS.md](../AGENTS.md) retains authority. The [domain model](domain-model.md) defines the working DEC profile used by [requirements](requirements.md), [features/use cases](features.md), [database/RLS](databases.md) and the [FastAPI contract](api.md). The six domain review findings are addressed structurally; [handoff](handoff.md) records remaining product decisions.

## Interactive diagrams

Each standalone HTML has themes, focus/search and export controls. JSON is the editable native source. Diagram labels are English and visually follow the existing Archify example. Ten diagrams separate the four aggregates instead of presenting one combined donation/offer/booking/stock status.

| Diagram | Interactive HTML | Source | Trace |
|---|---|---|---|
| System | [System architecture](architecture/dono-architecture.html) | [candidate.json](architecture/candidate.json) | BR-001–BR-006; NFR-001/002 |
| Actors and boundary | [UML-style use cases](architecture/use-cases.html) | [use-cases.json](architecture/use-cases.json) | UC-001–UC-012, UC-015/016; optional UC-013/014 in notes |
| Creation and delayed evidence | [Photo / human facts / AI](architecture/donation-creation.html) | [donation-creation.json](architecture/donation-creation.json) | FR-007–FR-011, FR-038; UC-003–UC-005 |
| Match and human decision | [Matching / review](architecture/matching-review.html) | [matching-review.json](architecture/matching-review.json) | FR-013–FR-017, FR-033/034; UC-006–UC-008 |
| Booking, QR and recovery | [Booking / reception](architecture/booking-reception.html) | [booking-reception.json](architecture/booking-reception.json) | FR-023/024/035/036; UC-010/011/015 |
| Reusable item | [Donation lifecycle](architecture/donation-lifecycle.html) | [donation-lifecycle.json](architecture/donation-lifecycle.json) | FR-033/036; UC-007/015 |
| Recipient attempt | [Offer lifecycle](architecture/offer-lifecycle.html) | [offer-lifecycle.json](architecture/offer-lifecycle.json) | FR-017/033/035/036; UC-008/015 |
| Appointment | [Booking lifecycle](architecture/booking-lifecycle.html) | [booking-lifecycle.json](architecture/booking-lifecycle.json) | FR-023/024/035/036; UC-010/011/015 |
| Physical stock | [Inventory lifecycle](architecture/inventory-lifecycle.html) | [inventory-lifecycle.json](architecture/inventory-lifecycle.json) | FR-022/034/036; UC-011/012 |
| Relational data | [Full database ERD](architecture/database-erd.html) | [database-erd.json](architecture/database-erd.json) | All 21 application tables; FR-033–FR-038; NFR-001/004/005 |

Use-case boxes are UML-style responsibilities inside a system boundary, not native UML ellipses or deployable services. Repeated actor appearances denote the same role. Sequences show alternatives explicitly: cancellation/no-show is an alternative **before** reception, never a later cancellation of received stock. Lifecycle diagrams use native Archify v3 states; inventory states are derived labels, not a stored enum/table column.

The archived system and use-case diagrams still label authentication as Google OAuth. The current authentication contract is email/password in [DEC-008](domain-model.md#working-defaults); the diagram JSON sources are absent in this checkout, so these historical exports were not regenerated.

## Components and trust boundaries

Next.js renders donor, association and platform views, establishes Supabase sessions and sends bearer access tokens to FastAPI. It never receives provider/elevated/QR secrets and does not duplicate business APIs in Route Handlers or server actions. FastAPI verifies JWTs, resolves current enabled profiles/memberships, validates files and DTOs, orchestrates restricted database commands and calls OpenAI/BAN outside transactions. Use one Python runtime with thin routers and shared domain functions; no ORM, queue or worker fleet is necessary for this MVP.

Supabase Auth uses email/password signup and sign-in. Account confirmation is optional in hosted settings; donation notification emails and invitations remain outside scope. Postgres owns typed source data, history, scoped RLS and concurrency constraints. Postgres persists validated image base64 in private.photo_contents and immutable metadata/digests in donation_photos, atomically. There is no Supabase Storage service or bucket. The two database nodes in the system diagram show logical data groups in the same Postgres database. Photo content is fetched through an authenticated endpoint with fresh owner/offer-evidence scope checks, decoded to binary, and verified against size/digest. Lists never join private payloads. BAN address search uses IGN Géoplateforme, https://data.geopf.fr/geocodage/; Haversine calculation remains Python code. Jev probabilities are optional and never replace OpenAI extraction.

Ordinary database reads carry the user JWT and RLS. Business commands use restricted server-only capabilities with current actor/tenant/state checks inside the transaction. Merely using a service credential does not enforce permissions. RLS helper recursion, grants, fixed search paths and exposure of command wrappers are specified in [databases.md](databases.md#rls-grants-and-write-capabilities). No runtime permission has been verified because no policies/code exist yet.

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

Basic gallery/counts/FEFO use received undistributed lots only. Review offers remain separate. Reuse one item/evidence view and simple forms/lists; all five category schemas remain required. Cut Jev → comparison → timeline → agreement if needed. Never cut indicators, expiry buckets/distribute-first, review queue, QR reception or auth/RLS. No transport, routing, email or messaging paths exist.

## Validation evidence

The [current rules audit](architecture/validation/rules-consistency.json) records cross-document counts and unchanged current diagram hashes. The [base64 audit](architecture/validation/base64-consistency.json) retains the preceding diagram-delivery context.

All **ten current diagrams pass** Archify validation, delivery, strict artifact checks and real Chrome browser checks. Each passing receipt includes all nine artifact checks; sources, current HTML/delivery pairs and current finalize/browser evidence are byte-bound. There is no claim that these gates execute RLS, API behavior or capacity transactions.

| Diagram | Current automated receipt | Current browser proof | Current capture evidence | Structural errors / composition warnings |
|---|---|---|---|---|
| dono-architecture | [Finalize](architecture/validation/base64-v1/dono-architecture.finalize-summary.json) · [full](architecture/validation/base64-v1/dono-architecture.finalize.json) | [Browser](architecture/validation/base64-v1/dono-architecture.browser-check.json) | [Captures](architecture/validation/base64-visual/dono-architecture.visual-check.html) · [receipt](architecture/validation/base64-visual/dono-architecture.visual-check.json) | 0 / 0 |
| use-cases | [Finalize](architecture/validation/base64-v1/use-cases.finalize-summary.json) · [full](architecture/validation/base64-v1/use-cases.finalize.json) | [Browser](architecture/validation/base64-v1/use-cases.browser-check.json) | [Captures](architecture/validation/base64-visual/use-cases.visual-check.html) · [receipt](architecture/validation/base64-visual/use-cases.visual-check.json) | 0 / 0 |
| donation-creation | [Finalize](architecture/validation/base64-v1/donation-creation.finalize-summary.json) · [full](architecture/validation/base64-v1/donation-creation.finalize.json) | [Browser](architecture/validation/base64-v1/donation-creation.browser-check.json) | [Captures](architecture/validation/base64-visual/donation-creation.visual-check.html) · [receipt](architecture/validation/base64-visual/donation-creation.visual-check.json) | 0 / 0 |
| matching-review | [Finalize](architecture/validation/domain-v1/matching-review.finalize-summary.json) · [full](architecture/validation/domain-v1/matching-review.finalize.json) | [Browser](architecture/validation/domain-v1/matching-review.browser-check.json) | [Captures](architecture/validation/domain-visual/matching-review.visual-check.html) · [receipt](architecture/validation/domain-visual/matching-review.visual-check.json) | 0 / 0 |
| booking-reception | [Finalize](architecture/validation/domain-v1/booking-reception.finalize-summary.json) · [full](architecture/validation/domain-v1/booking-reception.finalize.json) | [Browser](architecture/validation/domain-v1/booking-reception.browser-check.json) | [Captures](architecture/validation/domain-visual/booking-reception.visual-check.html) · [receipt](architecture/validation/domain-visual/booking-reception.visual-check.json) | 0 / 0 |
| donation-lifecycle | [Finalize](architecture/validation/domain-v1/donation-lifecycle.finalize-summary.json) · [full](architecture/validation/domain-v1/donation-lifecycle.finalize.json) | [Browser](architecture/validation/domain-v1/donation-lifecycle.browser-check.json) | [Captures](architecture/validation/domain-visual/donation-lifecycle.visual-check.html) · [receipt](architecture/validation/domain-visual/donation-lifecycle.visual-check.json) | 0 / 0 |
| offer-lifecycle | [Finalize](architecture/validation/domain-v1/offer-lifecycle.finalize-summary.json) · [full](architecture/validation/domain-v1/offer-lifecycle.finalize.json) | [Browser](architecture/validation/domain-v1/offer-lifecycle.browser-check.json) | [Captures](architecture/validation/domain-visual/offer-lifecycle.visual-check.html) · [receipt](architecture/validation/domain-visual/offer-lifecycle.visual-check.json) | 0 / 0 |
| booking-lifecycle | [Finalize](architecture/validation/domain-v1/booking-lifecycle.finalize-summary.json) · [full](architecture/validation/domain-v1/booking-lifecycle.finalize.json) | [Browser](architecture/validation/domain-v1/booking-lifecycle.browser-check.json) | [Captures](architecture/validation/domain-visual/booking-lifecycle.visual-check.html) · [receipt](architecture/validation/domain-visual/booking-lifecycle.visual-check.json) | 0 / 0 |
| inventory-lifecycle | [Finalize](architecture/validation/domain-v1/inventory-lifecycle.finalize-summary.json) · [full](architecture/validation/domain-v1/inventory-lifecycle.finalize.json) | [Browser](architecture/validation/domain-v1/inventory-lifecycle.browser-check.json) | [Captures](architecture/validation/domain-visual/inventory-lifecycle.visual-check.html) · [receipt](architecture/validation/domain-visual/inventory-lifecycle.visual-check.json) | 0 / 0 |
| database-erd | [Finalize](architecture/validation/base64-v1/database-erd.finalize-summary.json) · [full](architecture/validation/base64-v1/database-erd.finalize.json) | [Browser](architecture/validation/base64-v1/database-erd.browser-check.json) | [Captures](architecture/validation/base64-visual/database-erd.visual-check.html) · [receipt](architecture/validation/base64-visual/database-erd.visual-check.json) | 0 / 61 |

Nine diagrams use showcase with zero composition warnings. The complete standard-quality ERD retains **61 composition warnings: 60 relationship crossings and one static desktop-readability warning**, with zero structural/edge-through-node errors and passing browser readability/containment. It includes every application column/key/FK role plus the managed Auth stub; no fields/relations were removed to conceal density. Four domain columns, focus views, search and vertical page scrolling support inspection. The dictionary supplies enum labels and composite/conditional constraints that individual FK edges cannot fully express.

Advisories remain: one routed detour in the system and use-case diagrams; one automatically routed crossover in the offer lifecycle; and ERD detours. They are preserved and visible, not erased by removing behavior. Current captures were inspected for all ten diagrams (a selected 1440 desktop image per diagram; ERD at 2048), checking readable labels, state separation and relationship routes. Both themes at 1440 and 2048 were captured automatically; not every capture pixel or every below-fold row received perceptual inspection. Long sequences/use cases/ERD intentionally scroll vertically. Capture JSON reports visualReview=pending because it records capture automation; this paragraph records the separate inspection.

The four photo-persistence diagrams were regenerated for base64; the six unaffected diagrams retain their matching domain-v1 proofs/captures. Older root/fastapi/domain-v2 and superseded domain-v1 photo-diagram receipts/captures remain historical evidence for their own bytes. Keep sources and current evidence alongside HTML; avoid broad JSON ignore rules. No historical artifacts were deleted during this correction.

## Regeneration

Use the installed Archify skill and exact type from each source. The available local Node binary may differ from PATH; no project package scripts exist. From the repository root, the command form is:

```sh
node .agents/skills/archify/bin/archify.mjs finalize lifecycle docs/architecture/offer-lifecycle.json docs/architecture/offer-lifecycle.html --quality showcase --out-dir docs/architecture/validation/domain-next --json
```

Use architecture for candidate/use-cases, sequence for the three sequences, lifecycle for the four state graphs and erd with standard quality for the full-schema ERD. Run each delivery sequentially in a shared output directory. A revision after browser evidence requires a fresh evidence directory; never hand-edit generated HTML. Retain native source/current delivery/finalize/browser receipts; screenshots are additional evidence and require inspection before claiming visual review.

## Analysis and expiry refinement — workflow unchanged

The two remaining blockers are specified in [analysis-v1](analysis-rules.md), [expiry-v1](expiry-rules.md) and [49 future fixture scenarios](rules-test-cases.md). Schemas are closed JSON contracts within existing extracted/attributes/provenance fields. Category confidence is not global OCR/acceptability confidence; nulls, conflicts and original provenance are explicit. Manual fallback remains the same donor/staff workflow.

FastAPI calculates item-expiry views/guards in Python. The existing restricted atomic command rechecks unchanged sources/evidence and the reference-day UTC clock fence, so a calculation made before midnight cannot commit afterward. It does not compute item expiry in SQL or persist the result. Physical commands retain the same actors/routes/states; date-specific acknowledgements/reason refine their existing guards.

No native diagram source or HTML was regenerated: topology, workflow messages, lifecycle transitions and physical schema are unchanged. Existing diagrams already show code expiry, immutable originals, corrections and explicit human review; their current byte-bound validation remains valid. The [rules consistency receipt](architecture/validation/rules-consistency.json) records the scoped documentation review. Application/provider/RLS/date tests remain unimplemented.

## Backend implementation status

The architecture is now backed by [FastAPI composition](../backend/app/main.py), explicit [REST response contracts](../backend/app/api/responses.py), pure [expiry](../backend/app/domain/expiry.py) and [matching](../backend/app/domain/matching.py), [OpenAI](../backend/app/adapters/openai.py)/[BAN](../backend/app/adapters/geocoding.py) adapters, and [PostgreSQL migrations](../supabase/migrations/). Ordinary reads use bearer-scoped RLS; privileged projections and commands reauthorize inside restricted functions owned by a dedicated application role.

No frontend, Storage bucket, transport, messaging, queue or worker was added. All ten native diagram sources/HTML artifacts remain unchanged because component boundaries, table columns and workflows are unchanged. Historical statements above about missing application tests describe the earlier diagram delivery; current runtime evidence is in [readiness](readiness.md).
