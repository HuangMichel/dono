# Dono readiness report

**Design revision: Next.js frontend + Python FastAPI backend.** No application, migrations or dependencies were implemented. Remaining product-policy decisions still block an unconditional schema/API freeze.

## Changes in this revision

- Updated [AGENTS.md](../AGENTS.md), [README](../README.md), [setup](setup.md), [requirements](requirements.md), [features](features.md), [architecture](architecture.md), [database design](databases.md), [API](api.md), [handoff](handoff.md) and [.env.example](../.env.example) to the requested frontend/backend split. The six binding product rules are preserved.
- Replaced generic text on closed database vocabularies with 18 named PostgreSQL enum types; allowed labels appear at each affected table column and in the [catalog](databases.md#enumerated-types). Unit/season labels remain provisional under AMB-008/009.
- Kept `attributes` for validated item facts and need criteria, with [examples and boundaries](databases.md#what-attributes-means). Original AI extraction, human edits and technical provenance remain separate.
- Kept private Storage for image bytes and database references/digests. [The photo rationale](databases.md#why-photos-use-storage-instead-of-base64-database-text) explains base64 overhead and the bytea alternative if database-only persistence is later chosen explicitly.
- Selected the government BAN address service through IGN Géoplateforme. AMB-021 service selection is resolved; adapter verification and AMB-009/016 privacy/radius questions remain.
- Replaced /me with GET/PATCH `/account/profile` and GET `/account/memberships`, bringing the catalog to 42 business operations. FastAPI bearer verification, CORS, error normalization, static-path ordering and authenticated private-image fetches are documented.
- Regenerated six affected [interactive diagrams](architecture.md#interactive-diagrams); retained the lifecycle source/semantics. Retained editable sources and current evidence; removed only unused historical JSON reports under the user's cleanup choice. Standalone HTML and image captures remain.

## Verification

The database dictionary and ERD cover 16 application tables, 153 columns and 30 FK roles, plus the separate managed Auth key stub. The six revised diagrams pass Archify validation, delivery, strict artifact and Chrome browser checks; the unchanged lifecycle retains matching passing evidence. Current system/ERD captures were inspected for readable labels, frontend/backend separation and enum types. The dense ERD has 25 documented composition warnings; no fields or relationships were removed to conceal them.

Documentation checks cover links/anchors, requirement/use-case/acceptance IDs and traceability, JSON examples, route uniqueness, enum/dictionary/ERD consistency, blank environment assignments, ignore behavior, current receipt hashes and cleanup dependencies. Final counts and exact evidence paths are recorded in [architecture.md](architecture.md#validation-evidence) and [handoff](handoff.md#consistency-audit).

Verified design invariants remain: staff-only donation decisions; donor/active-membership isolation; immutable original AI evidence despite category edits; deterministic need/capacity/season/Haversine matching; read-time expiry/FEFO without stored derivatives; medicine exclusion; eligible individual-food scope; atomic booking/reception/stock intent; no transport, routing, email or messaging. These are design checks, not working runtime controls.

Cleanup result: **62 unused historical JSON reports removed; 38 JSON files retained**, including all seven editable sources, seven current HTML delivery receipts, current finalize/browser evidence and the three linked capture receipts. No standalone HTML or PNG file was deleted.

## Remaining decisions and implementation order

The [24-finding audit](handoff.md#consistency-audit) records resolved wording/technical choices and open questions. Main blockers remain auth without email and trusted membership bootstrap; upload/category schemas and analysis-basis recovery; expiry edges/timezone/PAO/intake policy; units/reservations/matching/privacy; booking exceptions and changes to booked address/hours/timezone; QR lifetime/no-shows/partials; retention and operational/model budgets.

Resolve dependent policies → pin/scaffold frontend and FastAPI tooling → auth/RLS/private Storage → needs/capacity/slots → validated analysis/evidence/corrections → Python expiry and deterministic matching/offers → human review/holds → booking/QR → reception/stock/distribution → basic gallery/expiry views → complete isolation, race, photo and browser verification.

Retain the [40-hour allocation](handoff.md#recommended-milestones-and-implementation-order), accounting for two toolchains within the existing budget; re-estimate at scaffolding rather than assuming the stack change is free. Optional cuts remain Jev → comparison → timeline → agreement. Frontend pnpm checks, backend Ruff/mypy/pytest, database/API concurrency tests and the 25–35-photo evaluation were not run: neither application nor its fixtures exists.
