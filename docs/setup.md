# Development setup

FastAPI is implemented in `backend/`; the browser-local Next.js demo is in `frontend/`. They are not connected yet. The backend uses Supabase Auth and PostgreSQL, OpenAI Responses Structured Outputs and government BAN through IGN. Photo bytes are canonical base64 in `private.photo_contents`; Supabase Storage is disabled. No hosted resources were provisioned by this implementation.

## Frontend demo

From `frontend/`, run `pnpm install --frozen-lockfile` and `pnpm dev`. Open `http://localhost:3000`. No service credentials are required for demo personas and browser-local data. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` to check the frontend. See [frontend/README.md](../frontend/README.md) for demo limits.

Starting the backend does not replace demo persistence. Reconcile the [integration differences](requirements.md#backend-integration-differences) before adding authenticated API calls.

## Install and run the backend

Install Python 3.12 and uv. From the repository root:

```sh
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload
```

The committed lockfile selects dependencies published before 2026-10-18. FastAPI exposes `/docs` and `/openapi.json`; business endpoints are under `/api/v1`. Startup works without provider credentials, but protected operations then return explicit configuration/provider errors. It does not fabricate an authenticated user or AI analysis. The frontend demo runs independently and does not use these API routes.

Select the backend entries from [.env.example](../.env.example) into an ignored `backend/.env`, or set deployment environment variables. All template values are blank placeholders. Do not overwrite an existing environment file or put backend secrets in public settings.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Chosen Supabase project URL, to be shared with frontend Auth when wired. |
| `SUPABASE_PUBLISHABLE_KEY` | Public app key accompanying verified user JWTs and scoped reads. |
| `SUPABASE_SECRET_KEY` | FastAPI-only credential for restricted database commands. No legacy JWT-key fallback is implemented. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Server credential and explicitly selected model supporting vision and Structured Outputs. No model was selected or live-tested in this work. |
| `ANALYSIS_PROVIDER` | Defaults to `openai`; Jev/hybrid remain outside this implementation. |
| `QR_SIGNING_KEY` | Independent random server secret of at least 32 characters for signed QR payloads and domain-separated cursors. Do not reuse another service key. |
| `APP_ORIGIN` | Exact allowed HTTP(S) frontend origin; blank disables cross-origin browser access. CORS does not grant API permissions. |
| `GEOCODING_BASE_URL` | Defaults to `https://data.geopf.fr/geocodage/`; `/search` uses the BAN address index. |

Approved fixed photo policy: JPEG/PNG/WebP, 5 MiB decoded image bytes, three photos per donation, 20 megapixels. OpenAI timeout is 60 seconds and analysis lease 120 seconds. Changing fixed photo/lease values requires synchronized database policy changes. Missing AI configuration or failed analysis preserves the manual workflow. Configure deployment request-body/spool limits and rate/cost budgets before public exposure (AMB-019).

## Supabase deployment prerequisites

`supabase/config.toml` and ordered imperative migrations exist. The CLI was initialized and migration files were generated; the Docker-based Supabase stack was not started. Embedded PostgreSQL tests apply the actual migrations, but do not substitute for managed Supabase deployment validation.

1. Choose a development project or local CLI stack. Inspect your installed `supabase --help` and subcommand help. Local stack startup requires Docker access. Review migration contents and target identity before any push/reset; this work did not execute either against a hosted project.
2. Apply the ordered [migrations](../supabase/migrations/) to that development target using the selected Supabase migration workflow. Verify PostgreSQL 17 compatibility, role ownership privileges, public-schema exposure and grants. Public app tables have scoped RLS; `private` is not exposed. Storage, mail testing, Realtime and Edge runtime are disabled in the supplied local config.
3. Configure Google OAuth and allowed redirect URLs in Supabase. No email login, invitations or SMTP are part of this MVP. FastAPI verifies access tokens via Supabase Auth `/user`; it ignores user-supplied role metadata and checks current profile/membership. A publishable key alone is not a user identity.
4. Create the initial platform administrator through a trusted database operator after Auth registration/profile bootstrap. Public bootstrap only creates donor capability. Do not introduce a public role-elevation endpoint. Association registration creates an inactive applicant administrator; platform approval activates that original applicant atomically.
5. Confirm server command privileges: `dono_command_owner` is a dedicated non-login owner without global BYPASSRLS. Ordinary callers cannot mutate app tables, invoke business commands or read private photo content. The server role executes guarded commands; it has no direct app-table write grant. Verify these controls through the real Data API and current Supabase advisors before launch.
6. Select a compatible OpenAI model, run one live strict-schema request per category, and evaluate the required 25–35 photo set. No real photo accuracy result is available yet. Configure redirect points and demo association needs/capacity/quotas/slots using trusted setup or authenticated APIs; no automatic production seed is provided.

No provider HTTP request holds a database transaction open. Use user-JWT scoped reads and restricted commands as implemented; do not replace them with blanket privileged reads. Keep FastAPI secrets out of Next.js. A production reverse proxy may route `/api/v1` to FastAPI under a common origin; deployment/ports remain unselected.

## Checks that exist

Run from `backend/`:

```sh
uv run ruff check .
uv run mypy app
uv run pytest -q --cov=app --cov-report=term-missing
```

Tests launch disposable embedded PostgreSQL using `pgserver`, create test-only Auth primitives and apply every migration. They require local process/socket permissions, not Docker or live credentials. Auth HTTP, the Supabase HTTP gateway and OpenAI responses are simulated; SQL constraints, commands, grants, RLS and concurrent connections execute in real PostgreSQL. Only synthetic tiny images are included. Tests must never use a production database.

Formatting is configured with Black; Ruff and strict mypy are the required static checks. Test evidence and remaining gates are recorded in [readiness](readiness.md) and [handoff](handoff.md). No claim is made that connected frontend behavior, hosted OAuth, target-mobile camera/QR rendering, the full Supabase stack or live model evaluation have passed.
