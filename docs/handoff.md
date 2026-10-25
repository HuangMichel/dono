# Handoff

Updated: 2026-10-25 18:06 CET

## Goal

Add required donation names and optional descriptions across donor and association views. Preserve the earlier Capacity and nearby-posting work and their deployment limits.

## Status

| Item | State | Notes |
|---|---|---|
| Item name and description | partial | UI/API/migration implemented; frontend 280 tests, lint/types and build pass. PostgreSQL execution and hosted migration remain pending. See [evidence](readiness.md#item-name-and-description-2026-10-25). |
| Capacity remake | complete | Screenshot composition, inline editing and real opening hours; 268 tests and build pass, live desktop/mobile checked without writes. |
| Nearby offers | partial | Posting/browsing source restored; frontend checks pass. PostgreSQL validation, hosted migration and authenticated browser acceptance remain pending. See [readiness](readiness.md#restored-nearby-offers-2026-10-25). |
| Corner notifications | complete | Shared popups for command, booking and donation actions; timer/dismissal tests and isolated desktop/mobile browser checks pass. |
| Design restoration | complete | Donor flow, booking/QR, dashboard, review, reception and stock layouts restored; 183 tests and isolated desktop/mobile browser checks pass. |
| Restoration acceptance | partial | Production compilation passed in an isolated copy; full live backend journey remains unverified. |
| Demo removal and API integration | complete | Existing source integration preserved; full live donor-to-staff acceptance remains separate. |
| Email/password Auth | complete | Existing signed-in account now loads its profile/membership state and protected donation list after the approved live repair. Confirmation-email delivery and fresh signup remain separate deployment checks. |
| Vercel preparation | complete | Both project configurations, runtime pins, upload exclusions, 4 MiB policy and [deployment commands](setup.md#vercel) are present. |
| Database update | partial | 21 local migrations; location/photo files generated. Auth, public needs and location have prior manual-application reports; verify and reconcile history. Posting/photo/item-details deployment remains unconfirmed. See [setup](setup.md#migration-status-and-cleanup). |
| Deployment acceptance | not started | Vercel deployment, legacy photo count and full connected flow remain unverified; manual hosted SQL applications are recorded separately. |

## Uncommitted work

- Donation details: frontend fields/display/retry handling, API facts/projections, tests and `supabase/migrations/20261025170000_donation_item_details.sql`; migration must precede the updated API/frontend.

- `frontend/app/association/capacity/`: screenshot layout, separate budgets, inline limit editing and save/refresh regression tests.

- Nearby posting: new backend routes, restricted migration, metadata-safe discovery photos, frontend posting/consent and gallery, regression tests and current product/API docs.

- Checkout `/Users/huang/Desktop/Github/experimentation/hackaton/dono`, branch `dono-backend-front-integration`, base `791ac4c`; extensive earlier frontend/auth/API work remains unstaged.
- `frontend/`: current work restores donor panels, booking calendar/pass, dashboard previews, review queue/detail, reception columns and inline stock details; adds draft recovery, QR invalidation and lazy-evidence safeguards and regression tests.
- `frontend/components/ui/notifications*`, account wrapper and action callers: top-right notifications, account isolation and stale-response suppression. Parallel camera work is documented separately in readiness; preserved.
- Prior frontend work includes real API/Auth flows, demo removal, the 4 MiB policy, Node 24 and upload exclusions; preserved.
- `backend/`: earlier health/booking, public needs, upload policy and Auth error mapping, Python 3.12/Vercel setup and tests remain; untouched by design restoration.
- `supabase/migrations/20261025165344_public_needs_location.sql` and `20261025165345_vercel_setup.sql`: generated and byte-identical to preparation payloads; no further generation needed.
- `supabase/changes/vercel/`: photo payload retained because scripts/tests still read it; ineffective Auth grant payload removed in favor of the managed_auth_bridges migration. No historical migration edits. The managed Auth bridge migration was applied remotely after user approval.
- `scripts/prepare-vercel-migrations.sh`: uses the real Supabase CLI to create one `vercel_setup` migration; repeated matching execution is safe, edited migrations are not overwritten.
- `docs/design/README.md`, `docs/readiness.md`: layout authority and restoration evidence clarified. Earlier deployment/runtime/size documentation remains; secret files are not read or included.
- No commit, push or Vercel deployment. The Auth repair was applied to Dono via SQL Editor. Preserve the existing exclusion of `docs/handoff.md` and `docs/readiness.md` from future staging.

## Verification

Item details: frontend 280 tests, lint/typecheck and final isolated build pass; backend Ruff/mypy and 68 focused checks pass. Live form validation and phone layout verified. Full backend suite: 116 pass, two TLS permission failures, 48 database setup errors.

Capacity: Node 24 lint/typecheck, 268 tests and clean-environment isolated production build pass. Live localhost desktop/mobile reads and editor controls verified; no real limit write.

Nearby posting: frontend lint/typecheck and 258 tests pass; backend Ruff/mypy and eight new HTTP tests pass, with 115 backend tests passing across full and focused runs. SQL tests and authenticated browser acceptance remain blocked; see current readiness for full-suite environment failures.

| Check | Command | Result | Revision or environment |
|---|---|---|---|
| Frontend static and tests | Installed ESLint, `tsc --noEmit --incremental false`, Vitest `--cache=false` | Pass; 205 tests/42 files | Node 24.22.0, current source including camera work, mocked service boundaries |
| Notification browser/review | Direct Playwright MCP and independent source review | Desktop/mobile popups, client navigation, dismissal and booking feedback pass; no review findings | Isolated API/Auth fixtures; no real writes |
| Restoration browser | Direct Playwright MCP against existing frontend | Seven routes pass at desktop/mobile widths; key interactions pass | Isolated API/Auth fixtures; no real writes; current HMR source |
| Restoration review | Independent source review with `optimize` and `refactor-review` | Recovery and duplicate evidence findings fixed | No runtime performance claim; `review-agent` unavailable |
| Backend static | `ruff check .`; `mypy app` | Scoped Ruff and mypy pass; 53 source files | Installed backend virtual environment |
| Backend tests | `env -i PATH=/usr/bin:/bin SSL_CERT_FILE=/etc/ssl/cert.pem <repo>/backend/.venv/bin/python -m pytest <repo>/backend/tests -q -p no:cacheprovider --tb=no` | 91 passed, 23 PostgreSQL fixture errors | Working directory `/private/tmp`; no local env files; psutil process enumeration denied |
| Earlier deployment review | Independent code review with `$optimize` | No actionable findings | Earlier deployment changes; `$review-agent` unavailable; no performance measurements |
| Migration script | `bash -n scripts/prepare-vercel-migrations.sh`; isolated stub-CLI checks | Pass | SQL copy, repeat, edit preservation and CLI failure; no real CLI execution |
| Live repair | Approved SQL Editor transaction, catalog checks, localhost browser | Passed | Profile/membership loaded; donation list rendered; helper owner/search path/ACL checks passed |
| Notification build | `next build --webpack` | Blocked at npm registry access | `/private/tmp/dono-notifications-build-r1jvbl49/frontend`, Node 24, synthetic public settings; separate camera build evidence in readiness |
| Live API in restoration pass | Read-only request to local port 8000 | Proxy returned `blocked-by-allowlist` / `not_allowed_local` | Environment restriction; no CORS code change |

## Not verified

- Item details persistence and frozen snapshots on PostgreSQL: local startup fails at process enumeration; direct initialization also fails at shared-memory creation. No hosted item-details migration was applied in this task.

- Nearby posting migration and real donor/staff flow: local PostgreSQL restrictions, no hosted migration applied and no authenticated browser session.

- Complete local SQL regression suite, legacy-photo count and migration history. Hosted Auth helper permissions and profile/list flow passed live checks.
- Vercel project settings, build/package output, full-size upload/read, model latency and end-to-end donor/staff/QR flow.
- Real photo accuracy and mobile camera/QR acceptance; required photo set/devices remain unavailable.

## Blockers

- Supabase CLI is now installed at `/opt/homebrew/bin/supabase`. The approved hosted bridge repair is complete; migration history needs reconciliation before a later db push.
- The pnpm build wrapper's registry lookup is blocked; direct installed Next.js CLI compilation works in an isolated copy. PostgreSQL process discovery and shared-memory creation remain denied; the existing frontend server is accessible.
- Existing `.env` reads are forbidden. Do not read, print, overwrite or bypass that restriction.

## Next step

1. Run item-details SQL/integration tests where PostgreSQL can start, then apply `20261025170000_donation_item_details.sql` after its prerequisites before deploying the updated API/frontend. Verify save, analyse, reopen and recipient snapshot behaviour against the deployed system.

1. Validate `20261025140000_posted_donations.sql` against PostgreSQL, apply it to the intended database, and verify the authenticated posting/browsing/unposting flow. Claiming remains excluded.

1. Run the production build and full connected donor/staff journey in an environment that permits registry and API access. See [restoration evidence](readiness.md#design-restoration-2026-10-25).
2. Auth repair `supabase/migrations/20261025115658_managed_auth_bridges.sql` is applied to Dono `wivxerqtkeiflfoyanpp`. Do not repeat the ineffective direct Auth schema grant. Verify/reconcile Auth, public needs and location history before the next database deployment; follow [setup](setup.md#migration-status-and-cleanup).
3. Verify the private Auth helpers and count historical photos above 4 MiB; keep the existing API host if any need an evidence-preserving delivery plan.
4. Create two Vercel projects with roots `backend` and `frontend`; configure exact domains, backend secrets and public frontend settings. Enable frontend Corepack for pnpm 11.0.9.
5. Deploy API then frontend from the repo root, configure Supabase URLs, and verify signup/profile plus the required donation journey.
