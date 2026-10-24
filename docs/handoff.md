# Dono implementation handoff and design audit

Reviewed 2026-10-24. **Ready for decision closure and implementation planning; not ready for an unconditional schema/API freeze or application delivery.** This review creates documentation/configuration templates only. No application, migrations, accounts, policies, Storage bucket or remote project settings were implemented.

## Authority and current state

[AGENTS.md](../AGENTS.md) overrides all other sources. [Requirements](requirements.md) hold stable BR/FR/NFR IDs and AMB questions; [features](features.md) hold use cases/acceptance criteria and traceability. [Architecture](architecture.md), [database design](databases.md) and [API](api.md) refine that baseline. DB-P01–DB-P07 are reviewable proposals, not accepted business policies. A narrower API proposal does not resolve an open product permission or lifecycle decision.

Reviewed inputs: AGENTS.md, the original README, all five existing `docs/*.md` specifications, and all seven diagram sources: [system](architecture/candidate.json), [actors/use cases](architecture/use-cases.json), [creation](architecture/donation-creation.json), [matching/review](architecture/matching-review.json), [booking/reception](architecture/booking-reception.json), [lifecycle](architecture/donation-lifecycle.json) and [ERD](architecture/database-erd.json). Revised diagrams have current Archify validation receipts. Required sources/evidence are retained; only unreferenced historical JSON reports are removed under the user’s cleanup choice.

| Area | Current state | Remaining evidence |
|---|---|---|
| Product specification | 6 binding rules, 32 functional and 10 non-functional requirements; 21 features, 14 use cases. | Product decisions and observable implementation acceptance. |
| Data design | 13 required + 3 support tables, 153 application columns, 30 FK-role relationships; separate managed Auth key stub. | Reviewed migrations, grants/RLS, guards and real database tests. |
| REST design | 42 planned FastAPI operations, closed DTOs, examples, errors and cursor/retry conventions. | Handlers, verified sessions, command functions and contract tests. |
| Diagrams | Seven interactive HTML artifacts with sources and prior validation evidence. | Six views regenerated for FastAPI/BAN/enum changes; lifecycle semantics retained. Current evidence replaces stale validation links. |
| Application/tooling | No frontend/package.json, backend/pyproject.toml, app scaffold, migrations, seed data or photo fixture set. | Runtime/package versions, scripts, deployment and test harnesses. |

## Binding decisions and proposed implementation profile

The six AGENTS business rules remain unchanged: human-only donation decisions; code-only arithmetic with read-time expiry; deterministic matching; no medicine donation; only non-perishable room-temperature individual food; no MVP transport or messaging/email. Five categories, indicators, expiry buckets/distribute-first, review queue, QR reception and auth/RLS remain protected scope.

The schema/API proposal separates immutable original analysis/indicators from current working facts, typed source dates and append-only human edits. Membership scopes association access; platform approval does not confer donation visibility. Guarded transaction commands own writes; client DML is denied. These are documented safeguards requiring implementation, not working controls.

The following choices still require agreement under the existing AMB questions:

| Proposal | Current proposal | Decision impact |
|---|---|---|
| DB-P01 | Protected platform capability + per-association roles; admin-only configuration; verified applicant. | AMB-001/002: management rights, role provisioning and bootstrap. |
| DB-P02 | Persist `draft`; one target/need and one booking; freeze facts after offer; one full receipt; no cancellation/reversal endpoints. | AMB-004/008/010/012/013: changes may alter keys, transitions and endpoints. |
| DB-P03 | Exact `numeric(12,3)` quantities and explicit shared units; integral `item`. | AMB-008: units/physical capacity must be meaningful for all five categories. |
| DB-P04 | Approval reserves need/capacity; receipt converts the hold; distribution releases capacity without reopening fulfilled need. | AMB-008: approve before writing aggregate/locking tests or reservation logic. |
| DB-P05 | Slot counts drop-offs; signed booking reference with nonce/deadline; explicit staff reception. | AMB-010/011/013: lifetime, timezone, exceptions and invalidation. |
| DB-P06 | Finite [0,1] probabilities/confidence with original decimal preservation. | AMB-017/018: provider schema and optional Jev sourcing. |
| DB-P07 | Staff intake assertions enforce actual medicine/food exclusions. | AMB-007: warning threshold, clarification and expired-item policies. |

## Consistency audit

“Aligned” means the specifications agree, not that runtime behavior was tested. “Resolved in documentation” fixes wording/abstraction without claiming a missing product choice is agreed. “Open” identifies a decision or contract repair needed before dependent work. Every finding remains subordinate to AGENTS.md.

| ID | Finding and cross-document evidence | Disposition / implementation consequence |
|---|---|---|
| AUD-001 | Original README called impact/advanced metrics MVP and grouped timeline/agreement into the dashboard; FR-026–FR-030 and AGENTS define optional cuts/proposed deferral. | **Resolved in documentation:** README now follows the M/S/P baseline, preserves the exact cut order and labels advanced reporting deferral as proposed. AMB-020 remains open if a measured counter is requested. |
| AUD-002 | Original README quickstart could imply `pnpm install/dev` yields an app; no package/scripts/migrations exist. Architecture/API are plans. | **Resolved in documentation:** README/setup mark every application command as future and describe prerequisites. App verification remains unrun. |
| AUD-003 | AI extraction, human corrections and human `decision` are distinct in BR-001, UC-004/005/008, sequences, ERD and API. “Approved” in lifecycle names is a staff status. | **Aligned:** retain original provider/model/category/facts/probabilities/confidence and photo provenance. Human decision actor/time are separate; no model/donor decision endpoint. |
| AUD-004 | Category edits must preserve originals, mismatch and medicine concern. API exposes only pre-offer edits and a retained basis; product reanalysis/current-result/post-offer policy remains AMB-004. | **Open:** DB-P02 is conditional. Define analysis-basis adoption after a first analysis races with an edit: evidence may commit with `working_facts_seeded=false`, yet offering requires a non-NULL basis. Do not leave a valid draft permanently unofferable or replace human facts to repair it. Agree recovery/retry rules before implementing this path. |
| AUD-005 | FR-001/NFR-001, actor matrix, diagrams and RLS agree on owner/active membership; API provisionally gives configuration only to admins. Platform capability grants association approval only. | **Aligned with an open split:** AMB-001/002 still block final management grants and bootstrap. Do not infer staff configuration or global platform reads. |
| AUD-006 | DB/API correctly require RLS plus grants, deny ordinary DML, and isolate server-only persistence/reception capabilities. Privileged functions can bypass RLS. | **Aligned design; implementation risk:** audit each private command's explicit actor/tenant/field checks, invoker wrappers, search path and grants. Direct RPC must not forge a provider output or validated QR. Confirm grants for new tables instead of relying on old defaults. |
| AUD-007 | AGENTS expiry labels `<90` and `>90` omit exactly 90; cumulative/exclusive bands, today, partial dates, PAO and timezone are undecided throughout requirements/API. | **Open:** AMB-005/006/011 need explicit expected outcomes. NULL/policy diagnostics are consistent interim reads but do not complete protected MVP expiry. Persist no derived values, including in retry result caches. |
| AUD-008 | BR-003/FR-014 and matching sequence require deterministic current eligibility. DB's decision summary previously emphasized intake/capacity without explicitly repeating season/need/association guards. | **Resolved in documentation:** DB/API approval guards explicitly recheck approved association, active matching need, category/unit/season and sufficient demand/capacity under locks. Refusal remains a human action and needs no successful eligibility result. |
| AUD-009 | API proposes ephemeral donor location; later offer/review eligibility may require a radius/origin, but the ERD has no retained donor-origin fields. DB/architecture broadly say revalidate eligibility. | **Open:** AMB-009/016 must decide distance as ordering versus an enduring eligibility constraint, and any protected retention needed. Do not claim full later distance revalidation from discarded coordinates. No hidden address column or routing service was added. |
| AUD-010 | Requirements leave capacity timing/units open; ERD/API give the coherent but provisional DB-P03/04 accounting. Multiple HTTP writes are not an atomic transaction. | **Open policy, aligned mechanism:** agree units/reservation/release first. Then enforce the common parent lock order, current aggregates, same-tenant FKs and retry completion in one transaction. No cached occupied/expiry counters. |
| AUD-011 | Preparing/capture-error in lifecycle are conceptual; ERD/API propose stored `draft`. Booking sequence says “booking + QR”; API separates committed booking from authenticated QR retrieval. | **Resolved as abstraction:** `draft` refines Preparing only if DB-P02 is agreed; failures add no approval state. UI may compose booking then QR GET. A QR-rendering/network failure does not roll back an already committed booking; retrieve the existing appointment/QR instead of creating another. |
| AUD-012 | FR-023/024 and booking/lifecycle diagrams require owner-approved booking and explicit target-staff receipt; DB/API supply one-booking/full-receipt constraints. Reversals/partials/no-shows are absent. | **Aligned, policies open:** AMB-010/012/013 decide lifecycle exceptions. A scan/resolve is read-only; confirmation creates one receipt. Do not add cancellation/re-offering transitions merely because an endpoint is convenient. |
| AUD-013 | Medicines and chilled/frozen individual food are excluded, but thresholds, clarification and expired DLC/DDM handling are open. Category labels and AI confidence cannot authorize intake. | **Aligned exclusion, open interaction:** AMB-007 and DB-P07 must be agreed. Confirmed excluded items cannot pass staff approval; no automatic AI refusal or category-based bypass. |
| AUD-014 | Earlier setup named legacy Supabase anon/service-role keys. | **Resolved technical baseline:** frontend and backend use documented publishable keys; elevated secret stays in FastAPI. The template has explicit public/server sections and no legacy fallback. AGENTS still protects any legacy service-role key if later used. |
| AUD-015 | User confirms the government BAN address service; the official listing points to IGN Géoplateforme. | **Service selection resolved AMB-021:** use https://data.geopf.fr/geocodage/. Adapter integration verification remains; radius/origin/privacy stay AMB-009/016. |
| AUD-016 | Original `.gitignore` covered only `ignore/` and `.agents/`; no environment template existed. | **Resolved in configuration:** blank-only template and environment/dependency/build/test/cache ignores added; existing rules retained. Lockfiles, docs, diagram receipts, migrations and seeds remain trackable. Ignore rules cannot remove previously tracked secrets. |
| AUD-017 | Revised diagram bytes invalidate prior receipts/captures as current proof. | **Resolved evidence handling:** use new FastAPI/enum receipts for changed views, retain current lifecycle evidence, and remove only unreferenced historical JSON. Dense ERD warnings remain disclosed; artifact checks prove no runtime behavior. |
| AUD-018 | API prose formerly made all quantities positive except capacity limits, although computed available demand/capacity and distributed remaining stock can legitimately be zero. DB aggregate invariants permit zero. | **Resolved in documentation:** distinguish positive donation/need/movement inputs from nonnegative read totals/balances and configured capacity. Keep exact decimal-string representation; do not reject empty stock or zero availability. |
| AUD-019 | Associations have nullable/changeable address/hours/timezone, while BookingDetail requires an address and only booked slot times are explicitly frozen. The lifecycle does not define effects on existing appointments. | **Open AMB-010/016:** agree address availability before booking and changes to appointment context. No implicit snapshot, relocation, timezone default or rescheduling was added. |
| AUD-020 | User changes backend ownership from Next.js to FastAPI. | **Resolved:** AGENTS, REST contract, setup and diagrams now distinguish Next.js frontend from Python FastAPI business backend. Backend-only secrets, bearer verification, explicit CORS and authenticated image-fetch behavior are documented. |
| AUD-021 | Closed vocabularies were shown as text even when values were specified. | **Resolved design:** named PostgreSQL enums and table-local allowed values now cover roles, category, unit, lifecycle, provider, source-date and event kinds. Unit/season labels remain provisional; no migrations generated. |
| AUD-022 | attributes could be mistaken for generic metadata; database-base64 storage was questioned. | **Clarified:** keep attributes for category-specific item facts/need criteria. Original extraction/provenance remain separate. Keep photo bytes in private Storage and references/digests in Postgres; database-only bytea would require an explicit later design change. |
| AUD-023 | User wants JSON cleanup without losing diagram maintenance. | **Resolved scope:** keep all seven sources, current delivery/finalize/browser/capture evidence and referenced dependencies; delete only unused historical generated JSON reports. Standalone HTML remains viewable. |
| AUD-024 | /me was disliked and GET/PATCH returned different resource shapes. | **Resolved contract:** GET/PATCH /account/profile and paginated GET /account/memberships, 42 total business operations. All operations belong to FastAPI; static-route ordering, scope validation and error normalization need future tests. |

## Lifecycle and permission checks

This table reconciles UC-007–UC-012, the lifecycle source and proposed DB/API. All commands also verify current identity, field allowlists, revision, scoped relationships and retry identity. Conditional policies above remain prerequisites.

| From → to | Actor / proposed command | Required guard and effect |
|---|---|---|
| Preparing (`draft` proposed) → same stage | Owner upload/analysis/correction | Validate files/schema; append original evidence; preserve human edits and provenance. Upload/analysis failure makes no decision. |
| Preparing → offered | Owner offer | Original analysis/photo basis and valid current facts; approved eligible target, matching need/unit/season and capacity/demand checks. No physical stock. |
| Offered → approved | Target active admin/staff decision | Explicit human approval, attribution, agreed intake assertions and current eligibility. DB-P04 would add a hold. |
| Offered → refused | Target active admin/staff decision | Explicit human refusal/attribution; preserve evidence. No booking or receipt follows this offer branch. |
| Approved → booked | Owner booking | Target slot/hours/time policy and remaining places; atomic booking/state. Existing category hold is not duplicated. |
| Booked → received | Target active admin/staff reception | Server validates signed QR, then explicit physical-receipt confirmation; one movement and state transition. No new donation decision. |
| Received → distributed | Target active admin/staff distribution | Received balance sufficient; full distribution completes state; no negative stock. Partial behavior awaits policy. |

No donor, provider or unrelated association may cross the human-decision boundary. Platform operators need a separate valid membership to act as association personnel; platform capability alone grants none. Expired/unknown/mismatch are read-side facts, not lifecycle states. No additional transition is authorized by this review.

## Decisions needed before dependent work

The complete question text and suggested decision owners remain in [requirements.md](requirements.md#ambiguities-and-decisions-required). The groups below organize work without replacing or closing IDs. Product owners should record answers in that register, update affected DB-P proposals/ACs, and then review schema/API/diagrams together.

| Gate | Questions to close | Work that depends on it |
|---|---|---|
| Identity | AMB-001/002; selected key names in setup.md | Auth method without email, applicant→admin bootstrap, role assignment/revocation, staff configuration, RNA/SIRET validation. |
| Evidence | AMB-003/004/017; analysis-basis race AUD-004 | MIME/content/byte/photo limits, category schemas, confidence/indicator contract, reanalysis/basis adoption, allowed edits. |
| Expiry and intake | AMB-005/006/007/011 | Bucket edges including exactly 90/today, PAO/partial dates, unknown ordering, timezone, thresholds/clarification, DLC/DDM handling. |
| Matching and capacity | AMB-008/009/016; AMB-021 adapter verification | Shared units, reservation/release, need/season/radius/ties, origin retention/disclosure, selected BAN geocoder adapter (service selection resolved). |
| Appointments and lifecycle | AMB-010/012/013 (with AMB-016) | Offer cardinality, frozen facts/reversals, slot limits/overlap, booked address/hours/timezone changes, cancellations/no-shows, QR validity/recovery and partial/mismatched receipt. |
| Release and reporting | AMB-014/015/019/020 | Count scope/formulas, retention/deletion/privacy, device/performance/model/cost limits and final advanced-reporting deferral. |
| Optional providers | AMB-018 (and AMB-017) | Jev image viability and Jev-only contract fields; unnecessary for the OpenAI baseline. |

No numerical defaults, authentication provider, retention period, distance weights, QR TTL or expiry interpretation were selected by this review. Proposed configuration variable names in setup are technical placeholders. Resolving decisions should stay short and specific enough to implement and test inside the effort budget.

## Recommended milestones and implementation order

The existing [40-hour allocation](features.md#delivery-priorities-and-forty-hour-budget) totals project effort, not elapsed time or effort per developer. The same allocation is retained below; dependencies guide implementation order. Introduce expiry source handling and pure calculations alongside evidence/matching once policy is agreed, even though final gallery work has a later delivery milestone. Verification is continuous; the five-hour verification allocation is not permission to postpone isolation or concurrency design.

| Milestone | Hours | Reviewable exit / dependencies |
|---|---:|---|
| Decision closure and integration contingency | 2 | Record blocking AMB answers and accepted/revised DB-P choices; check the geocoder and key-pair choice before dependent code. Reserve remaining time for fixes. |
| Scaffold, auth, RLS and association approval | 5 | Pin tools/packages; verified identity, trusted bootstrap, own/member isolation, private storage boundary and manual platform approval. |
| Needs, capacity, hours and slots | 4 | Structured form + confirmed free-text draft; agreed units/seasons/limits; scoped configuration. |
| Photos, five analysis schemas, evidence and edits | 6 | Validated uploads; immutable attributable originals; edits/mismatch/warnings; original/working date facts and analysis-race recovery. |
| Geocoding, deterministic matching, offer/status | 4 | Correct approved targets and current eligibility; no provider in matching; isolated offer visibility and stale-data guards. |
| Staff review | 3 | Explicit human decision, current intake/eligibility checks and atomic capacity/demand holds under the agreed policy. |
| Booking and donor QR | 4 | Atomic last-place booking; retrieve existing appointment and signed QR in-app; tested validity policy. |
| Arrivals, QR reception and stock/distribution | 4 | Target-staff confirmation once; retry safety, no negative stock and coherent capacity/need effects. |
| Expiry views and basic gallery | 3 | Resolved/read-time buckets and FEFO over received undistributed stock; unknown visibility; basic scoped counts/filters. |
| Verification and demo | 5 | Actual lint/typecheck/tests, direct RLS/RPC/Storage checks, concurrent races, 25–35-photo evaluation and complete donor→staff→distribution flow. |
| **Total** | **40** | **Required baseline; no stretch work budgeted.** |

Do not implement every API row as a separate service or build a generic workflow/warehouse system. Reuse item/detail and list UI, one Next.js frontend and one FastAPI backend and the documented simple transaction protocol. If baseline effort exceeds the remaining budget, surface the constraint; do not silently cut protected capabilities. Remove optional work in the exact AGENTS order.

## Known risks and next actions

| Risk | Consequence | Next action / evidence needed |
|---|---|---|
| Too many unresolved policies for a 40-hour build | Rework to schema, guards and acceptance tests; two-hour contingency may be insufficient. | Close dependency gates first, track actual effort and keep stretch disabled. |
| Auth bootstrap and privileged commands | No initial admin path, self-escalation or cross-tenant writes if implemented loosely. | Decide provisioning, review exact grants/functions, test direct Data API/RPC/Storage with isolated identities. |
| Holds without cancellation/no-show policy | Capacity/need may remain reserved indefinitely after non-arrival under DB-P04. | Agree minimum operational handling in AMB-008/010/012; do not ship an undocumented release rule or timer. |
| Analysis/upload races and separate Storage commits | Orphan files, duplicate provider cost, unseeded drafts or overwritten corrections. | Resolve AUD-004; test revision/lease fencing and define cleanup/retention. Logical idempotency does not promise exactly-once provider billing. |
| Unreliable label/medicine inference | Incorrect safety assumptions or fabricated dates. | Keep uncertainty visible, enforce actual exclusions, agree human intake workflow and evaluate medicine/para photos. |
| Derived expiry and changing page context | Wrong bucket/FEFO around midnight or stale cursor results. | Explicit reference date/timezone/policy and stable cursor context; boundary/DST/unknown/PAO tests. |
| BAN adapter and discarded origin | Integration outage or inability to recheck a later radius rule. | Verify the selected BAN adapter and resolve AMB-009/016 and perform a current contract smoke test at integration time. |
| Device/browser QR and camera behavior | Demo works only on desktop; reception cannot complete on target hardware. | Agree device matrix and camera-failure/retrieval flow; test before final demo. |
| Original evidence vs deletion | Immutability mistaken for indefinite personal-data retention. | Resolve AMB-015, document privacy/retention and separate authorized deletion from product edits. |
| Dense ERD and old receipts | Readers mistake warnings or stale evidence for a fully validated runtime design. | Use current links/domain focus views and dictionary; preserve warnings/history. |

Immediate next action: record the remaining product decisions and verify the selected BAN adapter, then freeze the affected schema/API sections before creating migrations. Unrelated tooling preparation can proceed once implementation is authorized; this task did not scaffold it.

All seven [interactive diagrams and their sources](architecture.md#interactive-diagrams), [current validation evidence](architecture.md#validation-evidence), [setup plan](setup.md) and [readiness report](readiness.md) are linked for the next implementer. All seven editable sources and standalone HTML diagrams remain. Current evidence is retained, revised views are revalidated, and only unused historical JSON reports are removed; historical capture images/HTML remain historical.
