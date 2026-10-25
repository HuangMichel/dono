# Backend readiness report

FastAPI, PostgreSQL migrations/RLS and OpenAI integration are implemented. **96 tests pass; combined statement/branch coverage is 91%.** This is local backend evidence, not a claim of production readiness or measured AI accuracy. No frontend or hosted resources were created.

## Delivered

- [backend/](../backend/): uv project/lockfile, FastAPI composition, strict Pydantic request/response DTOs, Auth/authorization, domain services and provider/database adapters. All 64 documented REST method/path combinations are registered.
- [supabase/migrations/](../supabase/migrations/): 15 ordered migrations, 21 app/private tables, named enums, PK/FK/indexes/constraints, RLS, immutable original/history guards and atomic commands. [config.toml](../supabase/config.toml) selects PostgreSQL 17 and disables Storage.
- Backend tests cover deterministic expiry/matching, five analysis schemas, upload validation, failures/manual fallback, real PostgreSQL constraints/RLS/commands, lifecycle/history, membership recovery/revocation, late evidence privacy and concurrent capacity/booking reservations.
- [setup](setup.md), [handoff](handoff.md), [README](../README.md), AGENTS implementation commands and affected contract/status documentation updated. `.env.example` remains blank placeholders; local environments/caches/build output are ignored. Existing diagram sources, HTML and validation receipts were preserved; all diagrams remain linked in [architecture](architecture.md).

## Executed checks

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
4. Future Next.js UI and graphical QR rendering/scanning remain unimplemented. Jev/hybrid and optional analytics remain deferred under the 40-hour scope.

Recommended order: Supabase/Auth deployment validation → live OpenAI/photo evaluation → Next.js required flows → mobile end-to-end/resource-race checks and deployment limits. Details and assumptions are in [handoff](handoff.md).
