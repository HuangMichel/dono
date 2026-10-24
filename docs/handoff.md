# Dono implementation handoff and domain review

## Authority and current state

This is a **design baseline**, not implemented software. [AGENTS.md](../AGENTS.md) remains authoritative and its six non-negotiable rules are unchanged. The review's six issues were valid defects/gaps in the previous model; the corrected [domain model](domain-model.md) supplies one coherent working profile rather than postponing the core mechanics. [Requirements](requirements.md), [features](features.md), [architecture/diagrams](architecture.md), [schema](databases.md) and [FastAPI API](api.md) must be implemented together.

Next.js is the frontend and Python FastAPI is the business backend, as requested earlier. Supabase provides Auth/Postgres RLS with private base64 photo content; OpenAI supplies immutable extraction/indicators; BAN via IGN provides address search. There is no application scaffold, migration, live API, configured Auth provider or photo fixture set. Planned pnpm/uv commands are not runnable project commands yet. No remote Supabase changes were made.

## Decisions and proposed implementation profile

Working defaults DEC-001–DEC-012 are listed fully in [domain-model.md](domain-model.md#working-defaults). They deliberately resolve the six structural findings for the MVP; changing them is a product decision requiring synchronized constraints/API/tests/diagrams. They are proposed defaults, not previously agreed user facts.

- Reusable donor items have many historical recipient offers and at most one active attempt. Refusal ends an attempt, not an item. Each offer has at most one booking; cancellation/rescheduling uses a new attempt and fresh review.
- Separate requested item demand, storage places using a staff-declared rate, category/day intake quantities and appointment counts. Matching checks all four; approval holds demand/storage; booking adds dated intake/place; receipt consumes demand/intake and makes stock; distribution releases storage only.
- Review 72 elapsed hours; approval 24 hours to book; booked slot starts within seven days; receipt window [slot start, slot end+30m). Deadline equality is expired. No extension, early/late override or required cleanup scheduler.
- Full lots only, one receipt and full distribution across all attempts; no splitting, partials, reversal or return. Independent donation/offer/booking enums and derived inventory projection preserve history.
- Google OAuth is the working no-app-email sign-in choice. Profile bootstrap grants donor only; registration creates an inactive applicant admin; platform approval activates that original applicant atomically. Admins configure/manage members; admin/staff review/receive/distribute. Last-admin protection, audited transfer/revocation and narrow original-applicant orphan recovery are baseline safeguards.
- Human input wins over any late AI response. Attach missing original basis separately from guarded empty-facts seeding. Complete human facts/photos may proceed without successful AI; staff explicitly acknowledge manual review and intake restrictions. Each offer freezes its own facts and evidence whitelist; later B-only facts remain private from A.
- Association timezone is required; demo Europe/Paris. Calendar seasons and stable nearest-first Haversine ordering are defined; no radius gate or retained donor origin. Slots fit one local day/hours, do not overlap, and booked context is protected.

The earlier DB-P01–DB-P07 proposals and AMB entries for these structural policies are superseded by this profile, not simultaneously active alternative contracts. Remaining unrelated AMBs below still require decisions.

## Consistency audit

| Finding | Previous contradiction / failure | Resolution across artifacts | Verification at implementation |
|---|---|---|---|
| REV-001 Donation versus offer | Association, need and final refusal lived on the reusable item; one booking per item prevented recovery. | donation_offers owns target/decision/snapshot; partial unique active offer; booking unique by offer, not donation. FR-033; UC-007/015; new item/offer diagrams. | Two concurrent submissions; refusal→same-item re-offer to A/B; preserved decisions/history. |
| REV-002 Demand versus capacity | One item quantity conflated need fulfilment, space and throughput. | needs, capacity, intake_quotas and slots are independent budgets; frozen storage rate and no used counters. FR-034; UC-002/006/008/010/012. | Exhaust each budget independently; approval/booking/configuration contention; distribution releases only space. |
| REV-003 Indefinite reservations | Approval/cancellation/no-show semantics were unresolved; capacity could remain blocked. | Stored finite source deadlines; half-open validity, live aggregates and bounded reconciliation; static partial uniqueness materialized before reuse. FR-035; UC-015; booking/reception sequence. | No-job idle expiry; exact cutoffs; expiry versus reception; once-only release/reconciliation. |
| REV-004 Incomplete lifecycle | One enum mixed decision, appointment and stock; refusal/reversal/partials undefined. | Four separate state machines; item withdrawal/restore; offer cancellation/expiry; booking cancellation/no-show; full-only ledger. FR-036; UC-015; four native lifecycle diagrams. | Cancel/receive race, transferred terminal, cross-attempt duplicate stock and recovery history. |
| REV-005 Undefined permissions | Applicant bootstrap, member grants/revocation and management rights were deferred. | Explicit Google/profile bootstrap, inactive initial admin + atomic platform activation; admin-only config/members; last-admin transfer/recovery; RLS/current membership and server command guards. FR-037; UC-001/016. | Forged metadata, concurrent last-admin changes, stale JWT/retry after revocation, private RPC/Data API bypass and orphan recovery misuse. |
| REV-006 AI versus corrections | Original rows were separate but first stale result could leave required basis unresolved; failure could block a valid item; historical reads could expose future facts. | Basis attach separate from seed; manual fallback; request fencing; frozen recipient evidence scopes and immutable snapshots; originals never mutate. FR-038; UC-005/008/015. | First delayed response after edit/offer; failed AI then manual approval; A→B privacy; no automatic decision/resource change. |

The six binding rules remain consistent: human-only offer decisions; deterministic arithmetic/read-time expiry; need/capacity/season/Haversine matching; medicine exclusion/pharmacy warning; nonperishable room-temperature individual food; in-app status with no transport/email/messaging. Medicine warnings are indicators, not AI refusal. Operational expiry of a lease is code, not a donation acceptance verdict.

Additional checked decisions remain: named SQL enums repeated with labels per column; attributes is validated item/need data, not technical metadata; private base64 text in Postgres, metadata/digest separately, no Supabase Storage; account/profile and account/memberships naming, no /me; FastAPI business routes, Next.js frontend; BAN through current IGN endpoint. New diagrams and sources are linked in architecture.md. Older receipts are historical and cannot prove revised bytes.

## Lifecycle and permission checks

Raw donations/expiry_info are donor-only. Personnel receive frozen offered facts and explicit evidence IDs, not unrestricted access to the mutable donor item. Original analysis context includes request ID, photos/digests and captured facts revision; related private request context cannot be discarded as a retry cache while evidence depends on it. Immutable photo originals and history remain scoped after refusal or withdrawal. Retention is still to decide; this is not an indefinite retention authorization.

Only the addressed association's current enabled personnel write the decision, once. Preserve approved decision/actor/time after later cancellation/expiry; do not rewrite it to refused. Pending offers hold no budgets. Actual receipt atomically transfers item, fulfils offer, receives booking and appends stock/events; distribution appends against receipt ID and changes no appointment/offer version. All item expiry calculations remain read-time and out of stored audit/response caches.

Ordinary reads use user JWT + RLS; clients have no table DML. Privileged write commands require explicit fresh actor/tenant/state checks and scoped execution grants. Serialize resource budgets, membership revocation and business writes using the common lock protocol. Read-time deadline predicates release availability even before stored-state reconciliation. These are required implementation controls, not claims that documentation proves secure runtime behavior.

## Decisions needed before dependent work

| Open item | Affected work | Next action |
|---|---|---|
| AMB-003 upload MIME/size/count/device rules | Photo validation, storage and analysis | Agree limits and server-side content checks before upload implementation. |
| AMB-005/006 — working expiry-v1 defined | Exact bucket/partial/PAO/DLC/DDM/FEFO rules in expiry-rules.md | Implement EX-T001–033; version changes consistently, do not invent alternative boundaries. |
| AMB-007 — working analysis-v1 / expiry-v1 defined | 0.50/0.80 warnings, manual clarification, strict-date and DDM assertions | Implement conditional human checks; probabilities never set decision. |
| AMB-017 — five closed contracts defined | analysis-rules.md fixes keys/types/nulls/confidence and conflicts | Implement AN-T001–016 and the photo evaluation; no Jev dependency. |
| AMB-015 retention, atomic photo cleanup, retry leases/retention and referenced context deletion | Privacy, evidence history, operational fencing | Set bounded policy and cleanup that respects evidence dependencies; avoid logging personal inputs. |
| AMB-019 target browsers, timeouts/model/cost limits and performance goals | Device testing and provider resilience | Pick deployment environment, model/tool versions and explicit budgets; no measured performance promised. |
| AMB-014/020 advanced metrics/impact scope | Optional reporting | Keep outside required delivery; formulas need separate agreement. |
| AMB-018 Jev image/contract viability | Optional S1/S2 only | Defer until the complete baseline passes. |
| Deployment credentials and manual verification process | OAuth login and legitimate association activation/recovery | Configure Google/Supabase redirects and trusted platform provisioning; agree who verifies RNA/SIRET/applicant identity. No app email/invite flow. |

AMB-001/002/004/008–013/016 now point to concrete defaults, with deployment prerequisites noted. Their former unresolved core mechanisms must not reappear as policy_required errors. BAN service selection AMB-021 remains resolved; verify current official search parameters/limits when writing its adapter.

## Recommended milestones and implementation order

This is an illustrative **40-hour total effort allocation**, not a guarantee. The domain safeguards add four small tables; private photo content adds one more small table and shared guarded commands, not microservices. Use full lots, one site, one active attempt, basic forms/lists and reusable evidence views to bound the work. Begin with constraints/auth/state contracts so UI cannot define inconsistent behavior later.

| Order | Deliverable and exit condition | Hours |
|---|---|---:|
| 1 | Resolve immediately dependent policy; pin/scaffold Next.js/FastAPI; implement identity/bootstrap/member commands, typed schema constraints/grants/RLS with tenant tests. | 7 |
| 2 | Admin needs/storage/dated quotas/hours/slots; prove independent budget/reduction guards. | 4 |
| 3 | Validated photos, five OpenAI schemas, originals/human facts, safe delayed completion and manual fallback. | 6 |
| 4 | Python deterministic matching and reusable offer creation/history; deadlines and replacement after expiry. | 5 |
| 5 | Human review with finite demand/storage holds and mandatory intake checks. | 3 |
| 6 | Atomic quota/slot booking, cancellation/no-show and signed QR reception with duplicate guards. | 4 |
| 7 | Full stock/distribution plus read-time expiry/buckets/FEFO/basic gallery. | 4 |
| 8 | Complete RLS/API/race/photo/device/end-to-end verification and demo. Test risky guards throughout, not only at the end. | 5 |
| 9 | Integration contingency and remaining policy fixes. | 2 |
| **Total** | Required MVP, no stretch budget. | **40** |

Exact optional cut order: Jev → comparison → timeline → agreement. Never cut indicators, expiry buckets/distribute-first, review queue, QR reception or auth/RLS. If required correctness cannot fit, surface a scope/time constraint rather than silently dropping these mechanisms. Detailed requirements are not permission to add partial inventory, appointment editing, new background services or broad platform administration.

## Known risks and next actions

The largest risk is the small time budget for two toolchains plus transactional/RLS correctness. Keep the database command surface small and reusable, and test the lock order before building all screens. Auth credentials/manual verification are prerequisites; Google availability is an external dependency and alternative no-app-email providers need a later explicit choice. Disabled-account/orphan recovery must use a trusted runbook and cannot become a backdoor for reassignment.

Deadline-based reads plus lazy state materialization require careful query/DTO consistency. UTC reference time must be captured after locks; a stale status cannot reserve or receive after cutoff. Membership helpers must avoid RLS recursion. Snapshot whitelists are validated references, not foreign keys, so scope validation/retention cannot be skipped. Daily quota/date and protected booked context need timezone/DST tests.

Manual fallback preserves usability during provider failure but still requires honest evidence status and human intake assertions. Do not turn low confidence into a fabricated clearance, or let a late indicator automatically cancel human approval. The defined analysis-v1/expiry-v1 defaults must be verified before delivery; remaining upload/retention/deployment limits must be settled before dependent implementation.

Next: review DEC defaults and settle immediately blocking upload/schema/shelf-life/safety choices, then implement milestone 1. The [readiness report](readiness.md) records actual documentation/diagram checks; the [setup plan](setup.md) marks all future application commands unimplemented.

## Photo persistence revision

The user explicitly replaces Supabase Storage with database base64. The current design has 21 application tables / 225 columns / 45 FK roles: donation_photos metadata loses object_path and private.photo_contents adds photo_id PK/FK plus image_base64 text. No application data needs migration because none exists; no bucket or remote service was changed.

Multipart upload and authenticated binary content routes remain stable. FastAPI validates, encodes and atomically commits metadata/content; reads reauthorize, decode and verify size/digest. Lists, matching, snapshots and retry/history contain no payload. Current frozen photo IDs/digests and original AI provenance are preserved. The extra encoding size, decode memory and database backup volume are design tradeoffs; actual upload/resource/retention limits remain AMB-003/015/019. This is a user-selected persistence choice, not a new domain lifecycle or an expansion of the 40-hour scope.

## Two-blocker resolution: analysis and expiry

The only new design scope in this revision is [analysis-v1](analysis-rules.md) and [expiry-v1](expiry-rules.md). They resolve AMB-005/006/007/017 with proposed defaults rather than generic policy_required responses. All five branches have closed fields/indicators and honest null/class/confidence semantics; low-confidence/conflicting/failed output retains the existing human fallback and immutable originals. Expiry uses one exclusive bucket, an explicit exactly-90 case, Python source/PAO/calendar rules, strict-date versus DDM checks and total FEFO order.

Existing columns/JSON, base64 persistence, auth/roles, offer/booking/resource policies and lifecycle diagrams stay intact. No native source/HTML changes are needed because these are contracts and guard details within existing workflows. Future verification is specified in [49 fixture scenarios](rules-test-cases.md); no application/provider/database tests were run. A 30-image photo evaluation remains to build. Calibration/model choice, upload/resource limits, retention and advanced reporting remain open/deferred; configurable per-association date policies and extra class fields are outside the 40-hour baseline.
