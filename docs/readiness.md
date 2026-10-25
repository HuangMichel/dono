# Integration readiness report

FastAPI, PostgreSQL migrations/RLS and OpenAI integration are implemented. **96 tests pass; combined statement/branch coverage is 91%.** This is local backend evidence, not a claim of production readiness or measured AI accuracy. That backend revision did not include a frontend. This integration branch now also contains the committed browser-local frontend demo; no hosted resources were created.

## Delivered

- [backend/](../backend/): uv project/lockfile, FastAPI composition, strict Pydantic request/response DTOs, Auth/authorization, domain services and provider/database adapters. All 64 documented REST method/path combinations are registered.
- [supabase/migrations/](../supabase/migrations/): 15 ordered migrations, 21 app/private tables, named enums, PK/FK/indexes/constraints, RLS, immutable original/history guards and atomic commands. [config.toml](../supabase/config.toml) selects PostgreSQL 17 and disables Storage.
- Backend tests cover deterministic expiry/matching, five analysis schemas, upload validation, failures/manual fallback, real PostgreSQL constraints/RLS/commands, lifecycle/history, membership recovery/revocation, late evidence privacy and concurrent capacity/booking reservations.
- [setup](setup.md), [handoff](handoff.md), [README](../README.md), AGENTS implementation commands and affected contract/status documentation updated. `.env.example` remains blank placeholders; local environments/caches/build output are ignored. Existing diagram sources, HTML and validation receipts were preserved; all diagrams remain linked in [architecture](architecture.md).

## Backend evidence inherited from dev

From `backend/`, on 2026-10-25:

| Check | Result |
|---|---|
| `ruff check .` | Pass. |
| `mypy app` | Strict checking of 52 source modules. |
| `pytest -q --cov=app` | 96 passed; 91% combined statement/branch coverage. One upstream Starlette/AnyIO deprecation warning. |
| Locked dependency consistency | `uv sync` succeeded using the committed lockfile; release cutoff 2026-10-18. |
| End-to-end API/SQL | Donor facts/photo → analysis → override → match → offer → staff decision → booking/signed QR → reception → inventory/distribution, plus collection/FEFO/gallery/configuration reads. |
| Real database races | Competing reviewers cannot consume the last storage reservation; concurrent bookings cannot consume the last appointment place or dated intake quota twice. |
| Privilege/privacy tests | Donor isolation; no ordinary client DML/restricted RPC/private image reads; original immutability; frozen A→B recipient evidence scope; current membership and last-admin/recovery controls. |
| Audited date correction | Explicit assertion + staff reason + frozen human facts; reviewed original IDs persisted; unchanged original evidence; current expired/unresolved strict source facts still block. |

SQL tests start disposable PostgreSQL and apply the actual migration files. Test-only Auth primitives and a simulated HTTP gateway replace managed Supabase services; HTTP identity verification and provider responses are simulated. Tiny synthetic images test mechanics, not vision accuracy. Existing Archify receipts validate diagrams only.

## Verified invariants

- AI extraction/indicators never decide approval/refusal; only authorized staff set the write-once offer decision. Late AI cannot overwrite human corrections or resource/decision state.
- Dates, PAO calendar arithmetic, exclusive buckets, strict-date checks and deterministic total FEFO run in Python at read/command time. Derived expiry values are absent from stored source facts and command audits.
- Matching is deterministic need + independent demand/storage/intake/place budgets + season + Haversine, with no model call. Resource mutations serialize through association locks and recheck live commitments.
- Stable donations are reusable after refusal; historical offers freeze facts/evidence, one active attempt at a time. Finite review/approval/receipt windows, withdrawal, cancellation/no-show and reconciliation release unreceived holds without a scheduler.
- Original analyses/indicators and photo digests/provenance remain separate from edited attributes/source dates. Photos persist as private canonical base64; lists contain authenticated content URLs, never payloads. No Storage SDK/bucket.
- Auth metadata cannot elevate roles. Association registration starts inactive; platform approval activates original applicant; last-admin transfer/revocation/recovery is audited. Membership-scoped RLS and guarded server capabilities apply.
- Medicines remain ineligible; staff must assert not-medicine, with original warnings preserved. Individual food requires room-temperature, nonperishable source facts and explicit staff eligibility assertion. No transport, routing, email or messaging implementation.

## Remaining release gates

1. Apply migrations to a chosen development Supabase project and verify managed ownership/grants, actual Data API/RPC restrictions, Google OAuth/redirects and current security/performance advisors. No remote provisioning or full Docker-stack run was performed.
2. Select/configure OpenAI model/credential and execute live strict-schema smoke tests for all five categories. Supply and evaluate 25–35 real photos including medicines and para products. Model quality/calibration remain unmeasured.
3. Decide photo/audit retention (AMB-015); configure deployment request-body/spool limits, rate/cost budgets and measure performance/mobile behavior (AMB-019). Multipart parsing precedes endpoint image-size validation.
4. Connect the existing Next.js demo to the backend after reconciling the [contract differences](requirements.md#backend-integration-differences). Graphical demo QR rendering does not verify backend-signed QR scanning. Jev/hybrid and optional analytics remain deferred under the 40-hour scope.

Recommended order: Supabase/Auth deployment validation → live OpenAI/photo evaluation → connected Next.js required flows → mobile end-to-end/resource-race checks and deployment limits. Details and assumptions are in [handoff](handoff.md).

## Integration branch verification

The branch starts at dev `8a4021a` and merges committed frontend `7aed137`. Runtime source and migrations are preserved from those parents; documentation conflicts are reconciled. Current frontend lint, TypeScript checks and 134 tests passed. The production build was blocked by registry network access. Backend Ruff/mypy/pytest did not run because Python 3.12/3.13 was unavailable and its download failed. Exact commands and environment limits are recorded in [handoff](handoff.md). Historical frontend checks are in [frontend/README.md](../frontend/README.md) and do not prove connected API behavior.

## Dernière exécution API

Voir le [rapport du 25 octobre 2026](reports/api-tests-2026-10-25.md) : **97 tests réussis**, **130 vérifications HTTP curl + 17 scénarios de dates**, couverture combinée **91.56 %**. Cette campagne utilise PostgreSQL réel temporaire et des transports Auth/Supabase/OpenAI/BAN simulés. Les valeurs précédentes de ce document restent le bilan historique ; les validations hébergées restent à faire.

## Vérification réelle des services

La campagne [Supabase/OpenAI/BAN du 25 octobre 2026](reports/live-integrations-2026-10-25.md) a ensuite utilisé backend/.env : Auth et Data API Supabase répondent en HTTP 200, les 22 noms de fonctions Dono correspondent aux migrations locales, Google est activé, et un appel OpenAI Vision gpt-5.4-mini réussit avec validation analysis-v1. BAN réussit également. Aucune écriture hébergée. Le parcours OAuth/métier avec utilisateurs réels et l'évaluation photo restent non validés ; les mentions antérieures d'absence totale d'appel réel sont désormais historiques.

Le nouvel [appel avec entrée/sortie conservées](reports/openai-example-2026-10-25/README.md) répond HTTP 200 mais échoue à la validation métier (deux indicateurs requis absents). Connectivité confirmée ; fiabilité contractuelle des réponses réelles non acquise. Le backend rejette cette sortie avec provider_invalid_output.
