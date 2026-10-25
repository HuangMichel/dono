# Development setup

Next.js in `frontend/` calls FastAPI in `backend/`. The backend uses Supabase Auth/PostgreSQL, OpenAI Structured Outputs and government BAN through IGN. Photo bytes remain in `private.photo_contents`; Supabase Storage is disabled. Runtime demo records and local seeding are removed. Existing remote data is not modified by startup.

## Frontend

Use Node.js 24 LTS. From `frontend/`, install locked dependencies and run `pnpm dev`. The default origin is `http://127.0.0.1:3000`; use that same origin in `APP_ORIGIN` and authentication redirects. Configure these public values before starting or building:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The same project's URL used by FastAPI. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That project's public publishable key. |
| `NEXT_PUBLIC_API_BASE_URL` | The FastAPI origin or full `/api/v1` base URL. |

Next.js supports the existing root environment file through `next.config.mjs`, alongside its normal `frontend/.env.local` handling. Only the three explicit public values are exposed by that configuration. Keep every privileged credential unprefixed and out of browser code. The public values are fixed at build time on Vercel; rebuild after changing them.

The public `/needs` directory requires the API connection and its database migration, but no visitor account or Auth session. Creating a donation requires authentication.

Enable Supabase email/password authentication. `/signup` creates an account and `/login` signs in with email and password. Signup requires at least eight password characters. An authenticated session creates or restores the donor-only application profile, then reads current memberships. No client role selection exists. The application does not create fictional business records when the database is empty or unavailable.

The local configuration enables email signup and disables email confirmation, so signup signs in directly. Hosted dashboard settings are separate from `supabase/config.toml`: enable the Email provider and new-user signup, set the password minimum to eight, and disable the Google provider. For direct signup without an email step, disable Confirm email on the hosted project too. Otherwise, signup displays a check-email state until the user confirms their address. Set Site URL to the frontend origin and allow `<frontend-origin>/auth/callback` and `<frontend-origin>/auth/callback\?next=**` in Redirect URLs. The second pattern preserves the selected need through email confirmation; `\?` matches the literal query separator. Keep the origin and callback path fixed. The application validates `next` against its donation route allowlist. See [Supabase redirect patterns](https://supabase.com/docs/guides/auth/redirect-urls). Keep the default confirmation link using `{{ .ConfirmationURL }}`; the browser SDK handles the PKCE code on the callback page. Open the link in the same browser that started signup, or sign in with email/password after confirmation.

If hosted confirmation stays enabled, configure email delivery for real users. Supabase's default mail service restricts recipients and sending rates; production confirmation needs custom SMTP. These are account emails only; donation notifications and invitations remain excluded. Existing Google-only accounts need a password set through a trusted Supabase account-recovery process before password login; this change does not delete or migrate accounts. [Password authentication](https://supabase.com/docs/guides/auth/passwords), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).

## Install and run the backend

Install Python 3.12 and uv. From the repository root:

```sh
cd backend
uv sync --locked
uv run --env-file ../.env uvicorn app.main:app --reload
```

The committed lockfile selects dependencies published before 2026-10-18. FastAPI exposes `/docs` and `/openapi.json`; business endpoints are under `/api/v1`. Startup works without provider credentials, but protected operations then return explicit configuration/provider errors. It does not fabricate an authenticated user or AI analysis. The frontend calls protected routes with a Supabase access token. The public needs GET requires no token. `GET /health` reports process liveness only; it does not verify database or provider availability.

The command above uses the existing root `.env`. Alternatively, place backend entries in `backend/.env` and omit `--env-file ../.env`, or set deployment environment variables. [.env.example](../.env.example) lists the required names. All template values are blank placeholders. Do not overwrite an existing environment file or put backend secrets in public settings.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Chosen Supabase project URL, shared with frontend Auth. |
| `SUPABASE_PUBLISHABLE_KEY` | Public app key accompanying verified user JWTs and scoped reads. |
| `SUPABASE_SECRET_KEY` | FastAPI-only credential for restricted database commands. No legacy JWT-key fallback is implemented. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Server credential and explicitly selected model supporting vision and Structured Outputs. No model was selected or live-tested in this work. |
| `ANALYSIS_PROVIDER` | Defaults to `openai`; Jev/hybrid remain outside this implementation. |
| `QR_SIGNING_KEY` | Independent random server secret of at least 32 characters for signed QR payloads and domain-separated cursors. Do not reuse another service key. |
| `APP_ORIGIN` | Exact allowed HTTP(S) frontend origin; blank disables cross-origin browser access. CORS does not grant API permissions. |
| `GEOCODING_BASE_URL` | Defaults to `https://data.geopf.fr/geocodage/`; `/search` uses the BAN address index. |

Approved fixed photo policy: JPEG/PNG/WebP, 4 MiB (4,194,304) image-file bytes, three photos per donation, 20 megapixels. OpenAI timeout is 60 seconds and analysis lease 120 seconds. Changing fixed photo/lease values requires synchronized database policy changes. Missing AI configuration or failed analysis preserves the manual workflow. Configure deployment request-body/spool limits and rate/cost budgets before public exposure (AMB-019).

## Local sign-in returns Database unavailable

If Auth succeeds but `/api/v1/account/profile` returns 503 with PostgreSQL `permission denied for schema auth`, apply [the managed Auth bridge migration](../supabase/migrations/20261025115658_managed_auth_bridges.sql) to the same Supabase project used by FastAPI. The earlier `GRANT USAGE ON SCHEMA auth TO dono_command_owner` suggestion does not work on hosted Supabase when `postgres` lacks the grant option.

The migration changes application functions only. It creates two restricted private Auth helpers and updates profile bootstrap plus four shared scope predicates. It does not change user accounts, managed schema ownership or application role assignments. Supabase documents this [private helper pattern](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema).

Use the CLI after inspecting migration history, or execute the exact file in the Dono SQL Editor as `postgres`, within `BEGIN;` and `COMMIT;`. The SQL is rerunnable. A manual SQL Editor application does not record CLI migration history; reconcile that history before a later `db push`. Retry connection in the app after application. A backend restart is not required for this database-only change.

## Supabase deployment prerequisites

`supabase/config.toml` and ordered imperative migrations exist. The CLI was initialized and migration files were generated; the Docker-based Supabase stack was not started. Embedded PostgreSQL tests apply the actual migrations, but do not substitute for managed Supabase deployment validation.

The repository now contains 21 ordered migration files, including the generated location filter and photo policy. No further generation is needed for these changes. See the migration status and cleanup notes below. Local files do not prove hosted application or recorded migration history.

1. Choose a development project or local CLI stack. Inspect your installed `supabase --help` and subcommand help. Local stack startup requires Docker access. Review migration contents and target identity before any push/reset; this work did not execute either against a hosted project.
2. Review and apply the ordered [migrations](../supabase/migrations/) to the selected development target. Verify PostgreSQL 17 compatibility, role ownership privileges, public-schema exposure and grants. Public app tables have scoped RLS; `private` is not exposed. Storage, mail testing, Realtime and Edge runtime are disabled in the supplied local config.
3. Configure email/password signup and sign-in as described above. Disable Google and choose whether the hosted project requires email confirmation. FastAPI verifies access tokens via Supabase Auth `/user`; it ignores user-supplied role metadata and checks current profile/membership. A publishable key alone is not a user identity. Credentials go directly to Supabase Auth, never to FastAPI business endpoints.
4. Create the initial platform administrator through a trusted database operator after Auth registration/profile bootstrap. Public bootstrap only creates donor capability. Do not introduce a public role-elevation endpoint. Association registration creates an inactive applicant administrator; platform approval activates that original applicant atomically.
5. Confirm server command privileges: `dono_command_owner` is a dedicated non-login owner without global BYPASSRLS. Ordinary callers cannot mutate app tables, invoke business commands or read private photo content. The server role executes guarded commands; it has no direct app-table write grant. Verify these controls through the real Data API and current Supabase advisors before launch.
6. Select a compatible OpenAI model, run one live strict-schema request per category, and evaluate the required 25–35 photo set. No real photo accuracy result is available yet. Configure real redirect points and association needs/capacity/quotas/slots using trusted setup or authenticated APIs; no automatic production seed is provided.

The current FastAPI service calls `dono_public_needs_in_location`, installed by `20261025165344_public_needs_location.sql`. Include that migration when provisioning another target.

### Migration status and cleanup

Snapshot: 2026-10-25. The user supplied a migration list with the first 15 versions matching remotely, through `20261025004750`. The following status combines that output, current local files and prior recorded deployment evidence. No fresh hosted schema check was performed for this documentation update.

| Version | Change | Next action on existing Dono project |
|---|---|---|
| `20261025115658` | Managed Auth bridges | Prior report records manual application; verify definitions and repair history only if missing. |
| `20261025121635` | Public needs | Prior report records manual application; verify definitions and repair history only if missing. |
| `20261025140000` | Posted donations | Local migration exists; runtime validation and hosted application remain unconfirmed. Do not mark applied without evidence. |
| `20261025165344` | Public needs location | Generated migration exists. Prior report records manual application of its identical payload; verify definitions and repair history only if missing. |
| `20261025165345` | Photo limit, 4 MiB | Generated migration exists; hosted application remains unconfirmed. |
| `20261025170000` | Donation item details | Appeared during this review; adds name/description and backfills existing names. Validation and hosted application are unverified. |

Run `supabase migration list` again because the supplied list predates the two generated files. For each manually applied change, compare its database definitions and grants with the migration before recording it. Only for a verified applied version missing from history, run:

```sh
supabase migration repair VERIFIED_VERSION --status applied
```

Replace `VERIFIED_VERSION` with one verified version from the table. Repair changes migration tracking, not the schema. After reconciling all three manual changes, the expected pending files are posted donations, the photo limit and donation item details, unless a newer deployment has applied them. A new empty target needs the full chain without history repair. [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

Cleanup assessment:

- Keep all versioned migrations and their filenames. Do not rewrite or remove historical migrations to resolve tracking differences.
- `supabase/changes/public_needs.sql`, `public_needs_location.sql` and `vercel/photo_upload_limit_4mib.sql` are byte-identical to their versioned migrations at this snapshot. They are cleanup candidates, but scripts and regression tests still read them.
- Before removing those copies, update `backend/tests/test_public_needs_database.py` and `test_photo_upload_limit.py` to read the corresponding migrations. Remove the obsolete fallback payload application in `backend/tests/conftest.py`, retire the preparation scripts together with their documentation references, then run the backend checks. This is proposed cleanup, not implemented work.
- Keep `supabase/manual/dummy_workflow.sql` separate from migrations and automatic seeds. It records an explicitly requested prior demo insertion; do not rerun it or treat its deletion as database cleanup. See [manual data notes](../supabase/manual/README.md).

The preparation scripts remain available for recovery and detect identical existing files. They do not deploy SQL. Do not generate another copy of these migrations.

No provider HTTP request holds a database transaction open. Use user-JWT scoped reads and guarded commands as implemented; do not replace them with blanket privileged reads.

## Vercel

Deploy two Vercel projects from this repository. Supabase continues to provide Auth and PostgreSQL.

| Project | Root Directory | Runtime | Configuration |
|---|---|---|---|
| `dono-api` | `backend` | Python 3.12, FastAPI | `app/main.py` is auto-detected; `backend/vercel.json` sets a 180-second maximum. Enable Fluid compute. |
| `dono-web` | `frontend` | Node.js 24, Next.js | `frontend/vercel.json` uses locked pnpm installation and `pnpm build`. |

Use different project names if those names are taken. Create/import both projects in the Vercel dashboard and set their Root Directory before running the commands below. Keep the default FastAPI build settings; do not configure a persistent Uvicorn start command. [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi).

New photos are limited to **4 MiB each**, leaving room for multipart framing below Vercel's **4.5 MB request/response limit**. The browser uploads one file per request directly to FastAPI. The prepared SQL enforces the same limit for new writes and preserves existing photos. Legacy photos above 4 MiB must be checked before moving the API. Do not delete or recompress original evidence to pass this check. [Function limits](https://vercel.com/docs/functions/limitations).

### 1. Prepare and apply the database update

The migration files already exist. From the repository root, inspect the target and reconcile history as described [above](#migration-status-and-cleanup) before previewing deployment. Install the Supabase CLI only if it is absent.

```sh
supabase --help
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
# Reconcile verified manual changes before continuing.
supabase db push --help
supabase db push --dry-run
```

Replace `YOUR_PROJECT_REF` with the selected project reference. Existing Dono is documented as `wivxerqtkeiflfoyanpp`; verify that it is the intended target. After verified manual changes are recorded, expect posted donations, the photo policy and donation item details unless newer history proves otherwise. Stop if the preview proposes replaying baseline table creation. Do not reset the hosted database.

Run the backend checks below in a terminal that permits the PostgreSQL test fixture. The SQL boundary, legacy-preservation and grant-repair tests could not run in the preparation sandbox. After those checks and the dry-run review, apply the update:

```sh
supabase db push
```

The Auth migration creates two narrow private functions owned by `postgres`: one returns the request user ID, and one checks whether a supplied Auth user exists. Only `dono_command_owner` can execute these helpers. The profile bootstrap and four scope predicates call them; other business functions keep their restricted owner. Hosted Supabase does not let `postgres` grant custom roles direct access to the managed `auth` schema, so the earlier `GRANT USAGE ON SCHEMA auth` repair is ineffective here. [Supported Auth access pattern](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema).

The separate photo migration changes the upload RPC and adds a constraint for new photo metadata. Existing oversized rows remain intact; the constraint is intentionally `NOT VALID` so PostgreSQL does not reject historical evidence.

Run this read-only check in the selected project's SQL editor:

```sql
SELECT p.oid::regprocedure AS helper, p.proowner::regrole AS owner,
       p.prosecdef AS security_definer, p.proconfig AS settings,
       has_function_privilege('dono_command_owner', p.oid, 'EXECUTE') AS command_access,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS browser_access
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname IN ('current_user_id', 'auth_user_exists');

SELECT count(*) AS legacy_photos_over_4_mib
FROM public.donation_photos
WHERE size_bytes > 4194304;
```

The two helpers must be owned by `postgres`, use `SECURITY DEFINER` and an empty search path, allow the command owner and deny direct browser execution. Direct Auth schema usage for `dono_command_owner` may remain `false`; the application no longer depends on it. If the photo count is nonzero, keep the current photo-capable API host until an evidence-preserving delivery plan is agreed and tested. Do not switch production photo delivery to Vercel yet. Generated migration files belong with the source when you later commit the setup.

### 2. Configure production environment variables

In each Vercel project, add the variables below to **Production** before deployment. Use the actual stable production domains assigned by Vercel, not a temporary deployment URL. The example domains are placeholders.

| Project | Variable | Value |
|---|---|---|
| API | `SUPABASE_URL` | Existing Dono project URL. |
| API | `SUPABASE_PUBLISHABLE_KEY` | Existing project publishable key. |
| API | `SUPABASE_SECRET_KEY` | Existing server-only secret key. |
| API | `OPENAI_API_KEY` | Existing server-only provider key. |
| API | `OPENAI_MODEL` | Chosen model supporting vision and Structured Outputs. |
| API | `QR_SIGNING_KEY` | Existing independent signing key, or generate one for a new deployment. |
| API | `APP_ORIGIN` | Exact frontend origin, e.g. `https://dono-web.vercel.app`, without a trailing slash. |
| Web | `ENABLE_EXPERIMENTAL_COREPACK` | `1`, to use the pinned pnpm 11.0.9 version. |
| Web | `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase URL as the API. |
| Web | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same public publishable key. |
| Web | `NEXT_PUBLIC_API_BASE_URL` | Stable API origin, e.g. `https://dono-api.vercel.app`. |

Vercel requires Corepack opt-in to use `packageManager` from `frontend/package.json`. Add `ENABLE_EXPERIMENTAL_COREPACK=1` to every frontend environment that you deploy. [Package manager selection](https://vercel.com/docs/package-managers).

`ANALYSIS_PROVIDER=openai` and the IGN geocoding URL already have defaults. Leave optional settings absent unless needed. Do not upload a root `.env` or copy backend secrets to the frontend. The ignore files exclude environment files and local artifacts from CLI uploads.

For a new signing key only, run `openssl rand -hex 32` locally and paste the result into the API project's `QR_SIGNING_KEY` setting. Preserve an existing key to keep existing QR payloads and cursors valid.

You can enter settings through the CLI instead of the dashboard. Link the correct project first, then use `npx vercel env add NAME production`; it prompts for the value. Use `env update` for an existing variable. Do not put secret values directly in shell commands. [Environment commands](https://vercel.com/docs/cli/env).

### 3. Deploy the API, then the frontend

Run Vercel CLI commands from the **repository root**. The remote Root Directory selects `backend` or `frontend`; running inside those directories can select the wrong source path. Linking again switches the selected project. Choose the same Vercel team for both links. [Monorepo deployment](https://vercel.com/docs/monorepos), [project linking](https://vercel.com/docs/cli/link).

```sh
npx vercel login
npx vercel link --project dono-api
npx vercel deploy --prod
```

Confirm the API's stable production URL and use it in the frontend's `NEXT_PUBLIC_API_BASE_URL`. Then deploy the frontend:

```sh
npx vercel link --project dono-web
npx vercel deploy --prod
```

These commands upload the current local source, including uncommitted changes. No Git push is required for this path. A later Git-triggered deployment uses committed source. Do not push a different revision and expect it to contain these local changes.

The API production URL must accept browser requests without an interactive Vercel login. Configure Deployment Protection accordingly; Supabase bearer-token checks still protect business endpoints. A protected API preview will reject frontend calls before FastAPI handles them. Preview environments need a separate backend with an exact staging origin or a stable staging domain; this backend accepts one CORS origin.

### 4. Configure Auth and verify the deployment

1. In Supabase Authentication URL Configuration, set **Site URL** to the frontend's stable production origin.
2. Add that origin followed by `/auth/callback` and `/auth/callback\?next=**` to **Redirect URLs**. The second entry preserves the selected need after confirmation. Retain local callback entries if you still develop locally.
3. Enable Email signup and choose the confirmation setting described in the frontend section. Configure SMTP if confirmation emails are enabled for real users.
4. Confirm `APP_ORIGIN` matches the actual frontend origin. Redeploy the API after changing it. `localhost` and `127.0.0.1` are different origins during local development.
5. Open `/signup`, create an account, and confirm profile loading succeeds. Sign out and sign back in.
6. Upload and retrieve a valid 4 MiB photo. Verify a 4 MiB + 1 byte photo is rejected before it changes the donation.
7. Verify analysis/manual entry, an offer, human review, booking/QR reload and reception with the appropriate accounts.

`GET https://<api-domain>/health` checks process liveness only. It does not prove Auth, database permissions, OpenAI or the donation journey works.

The managed Auth bridge migration was subsequently applied to Dono through SQL Editor with user approval, and local profile loading was verified. The photo-policy migration, Vercel project links and deployments remain pending. Inspect migration history before using the CLI after the manual repair. Current checks and environmental limits are in [readiness](readiness.md).

## Checks that exist

Run from `backend/`:

```sh
uv run ruff check .
uv run mypy app
uv run pytest -q --cov=app --cov-report=term-missing
```

Tests launch disposable embedded PostgreSQL using `pgserver`, create test-only Auth primitives and apply every migration. They require local process/socket permissions, not Docker or live credentials. Auth HTTP, the Supabase HTTP gateway and OpenAI responses are simulated; SQL constraints, commands, grants, RLS and concurrent connections execute in real PostgreSQL. Only synthetic tiny images are included. Tests must never use a production database.

Formatting is configured with Black; Ruff and strict mypy are the required static checks. Test evidence and remaining gates are recorded in [readiness](readiness.md) and [handoff](handoff.md). No claim is made that connected frontend behavior, hosted email/password authentication, target-mobile camera/QR rendering, the full Supabase stack or live model evaluation have passed.

## Plan de validation pas à pas

Voir le [plan de test du backend](test-plan.md) pour les essais automatisés, les sessions Auth réelles, le parcours Swagger et les critères de passage en préproduction. Ce plan ne constitue pas une exécution des tests.
