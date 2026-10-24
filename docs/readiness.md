# Dono domain correction readiness report

**The six review findings were valid and are now corrected in the design.** This is a coherent proposed MVP profile, with remaining product-policy choices explicitly open. No application code, migrations, dependencies or remote configuration were implemented.

## Created and updated files

Created [domain-model.md](domain-model.md) as the shared entity/state/accounting profile and added native sources/HTML for [offer](architecture/offer-lifecycle.html), [booking](architecture/booking-lifecycle.html) and [inventory](architecture/inventory-lifecycle.html) lifecycles.

Updated [requirements](requirements.md), [features/use cases](features.md), [architecture](architecture.md), [database dictionary/RLS](databases.md), [FastAPI API](api.md), [handoff](handoff.md), [setup](setup.md), [README](../README.md), [AGENTS.md](../AGENTS.md), [.env.example](../.env.example) comments and [.gitignore](../.gitignore). Regenerated all seven original diagrams and their sources; retained existing history and current validation/capture evidence. Removed duplicate broad architecture JSON ignore rules so editable sources and current evidence can be committed with the HTML.

## Verified design invariants

| Review issue | Corrected model |
|---|---|
| Donation versus offer | Stable reusable item ID; many historical offers; one active attempt; refusal permits re-offering; booking unique by offer, not item. |
| Demand versus capacity | Separate requested items, storage places/rate, dated intake quantity and appointment places; matching checks all independently. |
| Permanent reservations | 72h review, 24h approval-to-book, seven-day slot horizon, end+30m receipt cutoff; cancellation/no-show/timeouts release unreceived holds. Deadline-aware reads work without a scheduler. |
| Lifecycle | Separate item/offer/booking states and movement-derived inventory; withdrawal/restore/re-offer/cancel/recovery retain snapshots, decisions and history. Full lots only. |
| Permissions | Verified donor-profile bootstrap; inactive applicant admin + atomic platform activation; admin-only configuration/member changes; last-admin transfer/revocation/recovery; fresh database permissions/RLS and guarded commands. |
| AI versus corrections | Immutable originals/provenance; separate human facts; safe late basis attachment without overwriting; complete manual facts can proceed during AI failure; recipient-specific frozen evidence/privacy. |

AGENTS' six product rules were preserved byte-for-byte. Staff alone decide, matching/arithmetic are deterministic, item expiry is calculated at read time, medicines remain excluded, individual food remains nonperishable/room-temperature, and no transport/routing/email/messaging is included. Next.js remains the frontend and FastAPI the backend.

The [current static audit receipt](architecture/validation/rules-consistency.json) records the checked artifacts and limitations. Static checks confirm **54 requirement IDs** (6 BR, 38 FR, 10 NFR), **23 features**, **16 use cases**, **80 acceptance criteria** and complete requirement traceability. The API lists **64 unique method/path operations** with account/profile naming and no donation-level decision route. The schema/ERD agree on **21 application tables, 225 columns, 45 FK roles and 25 named enum types**, plus a separate managed Auth key stub. Links, JSON examples, closed vocabularies, key/nullability roles, blank environment values, ignore behavior and current artifact provenance were checked. These are specification checks, not executed business tests.

All **ten interactive diagrams** pass Archify artifact/provenance and Chrome browser gates; selected current captures were inspected. [Architecture validation evidence](architecture.md#validation-evidence) records exact receipts, captures and limitations. The dense ERD has 61 documented composition warnings (60 crossings, one static readability warning), while browser containment/readability passes and no field/relation was omitted. Other diagrams have zero composition warnings; routing advisories remain documented. Generated HTML is retained exactly as delivered, including renderer whitespace, to preserve provenance.

## Remaining decisions and recommended order

[Working DEC defaults](domain-model.md#working-defaults) resolve the six mechanisms; duration/unit/provider choices are proposed product defaults, not previous user facts. Analysis-v1/expiry-v1 now define all five category/indicator schemas, confidence/safety clarification and shelf-life/bucket/PAO/FEFO rules. Still decide upload limits, retention/retry leases and deployment/device/model/cost limits. Configure OAuth redirects/credentials and trusted manual association verification before use. No generic TBD remains in core offer, reservation or member-management behavior.

Implement in this order: dependent policy choices → auth/bootstrap/membership and schema constraints/RLS → independent intake budgets/slots → photos/original evidence/human facts/late-response safety → deterministic matching/offers/deadlines → human review/holds → booking/cancellation/QR reception → full stock/distribution and read-time expiry/FEFO/gallery → complete tenant/race/photo/device verification.

The [40-hour allocation](handoff.md#recommended-milestones-and-implementation-order) reserves verification and contingency. Reuse simple forms/evidence views; no partial lots, rescheduling engine, worker fleet or broad platform administration. Cut optional Jev → comparison → timeline → agreement; preserve the protected MVP capabilities. Frontend pnpm checks, backend Ruff/mypy/pytest, RLS/API/concurrency tests and the 25–35-photo evaluation remain future gates because their application/tooling/fixtures do not exist.

## Base64 photo revision

The user-selected design now stores image_base64 text in private.photo_contents, with donation_photos metadata/digest and an atomic photo write. Supabase Storage, object paths and DONATION_PHOTOS_BUCKET configuration are removed. The content API still serves authenticated decoded bytes; ordinary DTOs never return payload text. System, use-case, creation-sequence and ERD sources/HTML are regenerated and validated for this revision; unchanged state/matching/booking diagrams retain their matching evidence. Updated current receipt links are in architecture.md. No code, migration or existing data conversion was performed.

## Analysis and expiry blockers resolved on paper

Created [analysis-rules.md](analysis-rules.md), [expiry-rules.md](expiry-rules.md) and [rules-test-cases.md](rules-test-cases.md). Updated requirement/use-case, API, database, architecture and handoff contracts for these two issues only. There are 49 future fixture scenarios, including all bucket boundaries, partial/ambiguous dates, PAO/opening uncertainty, immutable originals and failed/late analysis. The [scoped audit receipt](architecture/validation/rules-consistency.json) verifies IDs/links/examples/contracts and unchanged diagram source/HTML bytes; it does not claim runtime test success.

No new tables, columns, routes, services, lifecycle states, app code or migrations; no native diagrams regenerated because workflows/physical schema did not change. Existing base64 photos, RLS, deterministic matching, human decisions and all six AGENTS rules are preserved. Thresholds and calendar defaults are proposed product choices, not measured model accuracy or general safety guarantees.
