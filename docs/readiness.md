# Integration readiness report

## Item name and description, 2026-10-25

Status: implemented in source; database acceptance and deployment remain pending. Donors enter a required name and optional description before photos and can edit them in item details. Names appear through shared helpers in My donations, booking, association dashboard, review, reception, stock, images and slots; nearby offers uses its explicit discovery projection. Descriptions appear in expanded donor details, booking and offer detail/evidence views. Category changes and photo analysis preserve donor text. Lost identity-save responses replay their original command before applying newer entries; concurrent changes stop the retry without overwriting them.

`20261025170000_donation_item_details.sql` adds bounded nullable columns, deterministic names for existing donations, readiness/submission guards and new snapshot/discovery fields. Historical offer snapshots and edit records remain unchanged. Apply the migration after its prerequisites before deploying the updated API/frontend. No hosted migration or deployment ran in this task.

| Check | Result and boundary |
|---|---|
| Frontend lint, types and tests | Passed on Node 24.22.0: ESLint, TypeScript and 280 tests across 47 files. API/Auth boundaries are mocked. Coverage includes required/whitespace validation, category changes, analysis text preservation, retries, concurrent edits, frozen evidence and expanded donor descriptions. |
| Backend static and focused checks | Ruff and mypy passed; 68 focused validation/domain/API/projection tests passed. |
| Full backend suite | 116 passed; two tests failed on TLS certificate-file permissions and 48 tests stopped at PostgreSQL fixture setup because process enumeration was denied. These failures did not execute the migration assertions. |
| Alternative database startup | A temporary runner used the installed PostgreSQL binaries and unchanged migrations/tests, avoiding global process enumeration. `initdb` still failed at shared-memory creation, including the escalated attempt. SQL persistence, migration backfill and snapshot tests remain unexecuted. |
| Live browser | Confirmed the server runs this checkout. Chrome showed the new fields, blocked blank and whitespace-only names with focus on the name field, and preserved both fields through category changes and manual continuation. The 390 × 844 layout had no horizontal overflow. No record or photo was submitted. |
| Visual checks | Desktop and phone layouts inspected. Impeccable's changed-file detector reported no regex findings; this is not a complete accessibility audit. |
| Independent review | No actionable findings remain. Source review covered SQL authorization/snapshot preservation and all item-bearing views. Read-only runtime checks with a substitute backend verified lost identity/upload response recovery and protection against intervening edits; they do not prove real PostgreSQL behaviour. |

The final production build passed with the installed Next.js CLI on Node 24.22.0 in an isolated copy without environment files. All 21 routes compiled and generated successfully after the final retry fixes. The pnpm wrapper attempted a blocked registry lookup; direct CLI execution needed no installation. Full save/analyse/reopen and donor-to-recipient acceptance against the deployed database remains unverified.

## Migration reconciliation snapshot, 2026-10-25

There are now 21 local migrations. Generated files `20261025165344_public_needs_location.sql` and `20261025165345_vercel_setup.sql` exist; each matches its preparation payload byte for byte. The public-needs migration also matches its payload. Earlier statements that these files still need generation are historical and superseded by this snapshot.

The user-supplied migration list records the first 15 baseline versions remotely, but not Auth bridges, public needs or posted donations. That list predates the two generated files. Prior reports below record manual application of Auth bridges, public needs and the location filter. Verify the actual definitions and grants before repairing those missing history entries. Posted donations and the photo policy remain unconfirmed on the hosted target. A further local migration, `20261025170000_donation_item_details.sql`, appeared during this review; its validation and hosted application are unverified. No fresh hosted inspection, SQL execution or database tests ran during this documentation update.

See [setup](setup.md#migration-status-and-cleanup) for the current sequence and proposed cleanup. Payloads remain required by scripts and tests; none were deleted.


The frontend uses Supabase email/password Auth and FastAPI business endpoints. Runtime demo data and simulated actions are removed. Current Vercel preparation targets two projects, Next.js and FastAPI, with Supabase for Auth and PostgreSQL. New uploads are capped at 4 MiB. The approved managed Auth bridge SQL was applied to the Dono project through SQL Editor. No Vercel deployment or Git push was performed.



## Capacity reference remake, 2026-10-25

The Capacity page follows the supplied screenshot: bordered category list, category names above long meters, right-aligned status and inline editing, and a bordered opening-hours panel. Storage and Daily intake remain separate views with their existing units and API commands. Admins edit limits; staff have read-only access. There is no invented weekly-kilogram budget or category pause action.

| Check | Result and boundary |
| --- | --- |
| Frontend | Node 24 lint/typecheck and all 268 tests pass. Capacity regression tests cover storage/intake payloads, admin/staff access, multiple opening intervals, empty/error states, context locking during saves and retention of failed input across balance refresh. Writes use mocked API boundaries. |
| Production build | Passed with installed dependencies from `/private/tmp/dono-capacity-build-75wnbn6q/frontend`, excluding environment files and using a clean environment plus synthetic public configuration. All 21 routes, including capacity and nearby offers, built successfully. This resolves the earlier build-environment blocker for the current frontend source. |
| Live browser | Confirmed the server cwd is this checkout. Chrome's signed-in localhost session loaded existing association data. Verified desktop layout, inline editor open/close and Storage/Daily intake switching. At 390 × 844, page width stayed 390 px and opening hours stacked below the list. No hosted limits or other records were changed. |
| Independent source review | Corrected pending-save date/context race and failed-draft loss after resource refresh. No actionable source findings remain. |
| UI detector | No source findings. Parsed-page detector rules did not run; visual checks above used the actual browser. |

Live limit writes were not exercised; exact write payloads, refresh ordering and failure recovery were checked through regression tests. No backend, migration or dependency change was needed for this page.

## Restored nearby offers, 2026-10-25

Source implementation restores explicit donor posting and authenticated association browsing. The user confirmed that claiming is excluded. Ordinary ready items stay private. Discovery uses municipality-centroid distance, category/radius filters, scoped item photos and factual indicators. Donors preview the shared item photos, consent to posting and can remove the post from My donations.

The new migration is `supabase/migrations/20261025140000_posted_donations.sql`. It is not applied to hosted Supabase. Existing donation reads remain compatible before migration because posting status extends the existing item summary without adding a mandatory RPC. The new discovery and posting routes require the migration.

| Check | Result and boundary |
| --- | --- |
| Frontend | Node 24 lint, typecheck and 258 tests across 47 files pass. Tests mock API/Auth boundaries; they do not establish hosted behavior. |
| Production build | Attempted from `/private/tmp/dono-posted-build-yb2zfwqe/frontend`, excluding environment files and using installed dependencies plus synthetic public settings. Registry network restriction blocked completion. |
| Independent source review | Four findings fixed: photo metadata exposure, missing type/product guard, donor-list posting projection and synchronous photo conversion. No actionable source findings remain; this is not runtime SQL or visual acceptance. |
| UI detector | No regex findings. Parsed-page contrast and tiny-text checks did not run. |
| Browser | Direct Playwright MCP could not attach because its browser profile was in use. Chrome through computer use displayed the real association route's sign-in gate. No authenticated gallery or responsive capture was available. |
| Live API | Read-only local OpenAPI request was blocked by the sandbox's local/private network restriction. |
| Backend static/API | Ruff and mypy pass (54 files); eight new HTTP tests pass with substituted database/provider boundaries. Full suite initially had 113 passed, two environment startup failures and 45 PostgreSQL setup errors. The two failures passed on a focused rerun with a clean environment and `SSL_CERT_FILE=/etc/ssl/cert.pem`; no tests or application code were changed for that rerun. Combined evidence: 115 tests passed, with 45 PostgreSQL cases blocked at setup. |
| Database | Isolated PostgreSQL startup blocked by process enumeration permissions; direct startup also failed on shared-memory access. The migration has not been runtime-validated or deployed. |

Remaining acceptance: run the SQL regression suite in a permitted PostgreSQL environment, apply the reviewed migration, then verify a real donor post, staff browse/photo view, unposting, revocation and desktop/mobile layouts. No account, post or other hosted business record was created during this implementation.

## English language consistency, 2026-10-25

Shared input, select and text-area errors now use English messages derived from browser constraint flags. They no longer copy the browser's localised validation text. Invalid submissions still stop, the first invalid control receives focus, and error messages remain linked to their controls. The analysis and need-parser prompts request British English for generated indicator descriptions and warnings, including when input text is French. Names, brands, printed labels, user-entered facts and existing saved evidence retain their original wording.

| Check | Result and boundary |
|---|---|
| Frontend lint, types and tests | Passed on Node 24.22.0. All 219 tests across 44 files passed. The eight new jsdom cases cover French native messages, email/pattern/number constraints, blocked submission, focus, callbacks, accessible error links, correction and disabled controls. |
| Production build | Passed in `/private/tmp/dono-english-build-xk37uh1g/frontend`, using the current source, installed dependencies and synthetic public configuration. Environment files were excluded. |
| Backend checks | Ruff and mypy passed, with 53 source files checked. Pytest had 91 passed and 26 setup errors. Every setup error came from PostgreSQL fixture startup because the sandbox denied process enumeration through `sysctl`; no assertions failed. Tests ran from `/private/tmp` without local environment files. |
| Live browser | Chrome served the new shared-field messages from the running checkout at `127.0.0.1:3000/signup`. Invalid email and empty password messages appeared in English. Submission stayed blocked, focus returned to email, and correcting the email removed its error. No account or business record was created. The French-native-message case uses jsdom; browser locale settings were not changed. |
| Independent source review | No actionable findings in the scoped prompts, shared validation, tests and language guidance. |
| Remaining limits | No live model call or photo-set evaluation ran; `tests/fixtures/photos/` is absent. Prompts request English but schema validation cannot verify language. Native browser/OS picker interfaces and existing stored evidence can retain their original language. |

## Runtime wording review, 2026-10-25

Reviewed and adapted the English copy across public, donor, company, authentication, association and administrator screens, including the camera/upload flow. Item, offer, appointment, received stock and given-out states now use the terms recorded in `DESIGN.md`. Category confidence describes classification only; an empty matching list does not claim that no association needs the item. Storage space, daily intake and appointment places remain distinct.

Known category values and date reasons have readable labels. User-entered names, brands, dimensions and original printed labels remain unchanged. Staff evidence shows the original extracted facts and before/after item corrections instead of raw JSON. API errors explain the action and recovery step while retaining server codes, HTTP status and request IDs for existing client logic. Connection failures during writes tell the user to check whether the action completed before trying again. No backend, database, dependency or workflow rule changed in this pass.

| Check | Result and boundary |
|---|---|
| Frontend lint and types | ESLint and TypeScript passed on Node 24.22.0. |
| Frontend tests | All 211 tests across 43 files passed. Focused coverage checks enum formatting without changing free text, preservation of original/corrected evidence, and safe API errors that retain recovery metadata. These checks use mocked service boundaries. |
| Independent review | No actionable findings remain in the reviewed runtime wording, labels, evidence display and API error mapping. |
| Live browser | Confirmed the Next.js server runs this checkout. Checked the updated home page, public needs list and detail, and the account prompt before offering an item in Chrome. Inspected the desktop needs layout. No business records were written. Authenticated staff flows and mobile layout were not exercised in this pass. |
| Production build | Blocked by the environment's registry access restriction. The isolated copy at `/private/tmp/dono-wording-build-e968s3hw/frontend` excluded environment files and used installed dependencies with synthetic public settings. The installed Next.js CLI could not complete because access to `registry.npmjs.org` was blocked. Earlier build results do not verify this snapshot. |

The wording review also records the existing reception limit accurately: the current API receives the full offered quantity and gives out the full remaining quantity. The earlier design proposal for receiving a smaller quantity remains unimplemented.

## Corner notifications, 2026-10-25

Association command results, sign-out failures, booking confirmation/cancellation and donation withdrawal/restoration now use dismissible top-right popups. Success/info messages close after six seconds and pause on hover or focus; errors do not expire automatically. The stack holds up to three messages and survives client navigation. An account change resets the provider. Field validation and resource errors remain inline. Ignored stale QR responses suppress success feedback.

ESLint, TypeScript and all 205 frontend tests across 42 files passed on Node 24.22.0. Focused tests cover completion after the submitting form unmounts, repeated results, duplicate-submit protection, dismissal, paused timers, persistent errors and stale QR suppression. Independent source review found no actionable defect. Browser checks against the running frontend passed at 1440 × 1000 and 390 × 844 with isolated API/Auth fixtures: success/error popups, manual dismissal, booking confirmation, preservation across client navigation, no focus theft and no horizontal overflow. Screenshots are under ignored `.playwright-mcp/notification-*.png`; no real records were written.

The notification build attempt used `/private/tmp/dono-notifications-build-r1jvbl49/frontend`, installed dependencies and synthetic public settings, excluding environment files. The environment blocked `registry.npmjs.org` before `next build --webpack` could complete. The separate camera build result below does not verify this snapshot. No backend changes were made for notifications.

## Item camera capture, 2026-10-25

Status: implemented with automated checks and partial browser verification. Item photos and label close-ups have a camera screen with local capture, review, retake, confirmation and file fallback. Camera replacement uses the existing photo validation and upload callbacks. No dependency, API or database change was needed.

| Check | Result and boundary |
|---|---|
| Frontend lint and types | Passed on Node 24.22.0. |
| Frontend tests | 199 tests passed across 40 files, including 16 new camera/upload tests. Browser camera, canvas and dialog APIs are mocked. Coverage includes confirmation, retake, replacement, file fallback, locked controls, saved-photo limits, permission errors, oversized captures and cleanup after cancellation or a late permission response. |
| Production build | Passed for an isolated copy of the current frontend with installed dependencies and synthetic public configuration. Environment files were excluded. The pnpm wrapper first stopped because its automatic dependency check wanted to replace the linked modules directory; invoking the installed Next.js CLI with the same `build --webpack` arguments succeeded without installing packages. |
| Independent source review | No actionable findings in the scoped camera/upload implementation. The named `review-agent` skill is unavailable; the reviewer used the acceptance criteria and project design guidance. |
| Live browser | Verified the running server uses this checkout. Chrome displayed the new item and label camera screens, the desktop modal and full-screen phone layout at 390 × 844. Escape closed the item screen and restored focus to its opener. Capture remained disabled while permission was pending. No camera permission was granted and no photo was uploaded during this check. |
| Remaining acceptance | Real hardware capture, native file-picker fallback and full keyboard traversal remain unverified. Browser automation timed out during the 844 × 390 landscape check. Camera/canvas mocks do not establish device image quality, rear-camera selection or mobile-browser capture behavior. |

The production build above verifies compilation and page generation, not hosted Auth, API persistence or an actual camera upload. Those integration gates remain separate from the camera component checks.

## Donor and table refinements — 2026-10-25, third pass

Status: implemented after a design review of the second pass. My donations now sets explicit column widths (Item 34% / Created 14% / Status 20% / Next step 32%) through a new `DataColumn.width` colgroup so the fixed-layout table fits the page and headers align with their content; an empty view renders a grey blocked-icon row inside the table (headers stay visible, the mobile list keeps its own copy). The analysis step shows the item subtitle in its heading, its details form is a two-column grid (one column under 768 px), and the AI probability bars use a styled progress track instead of native `meter` elements. The association search bottom-aligns its Find associations button with the address field. The offer-sent screen keeps the recipient name in session state (`sentTo`) so it cannot disappear with the match list, and returning to a donation with an active offer now shows an offer-review card ("Your offer is sent" while pending, "Approved by association staff" with a Manage drop-off action once approved, "Not accepted this time" when refused) instead of a one-line notice. Each donation-flow step ends with the shared StepActions bar: a Previous button ("Edit photos" / "Edit details") on the left and the step's Next action ("Analyse photos", "Save details and continue" via the form id, "Send offer for staff review") on the right; the sent screen keeps "Scan another item". Table and needs pagination already expose Previous/Next through the shared components.

| Check | Result and boundary |
|---|---|
| Frontend lint, types and tests | Passed: ESLint and `tsc --noEmit` with zero errors; 231 tests across 45 files with Vitest `--cache=false`. |
| Production build | Passed: `next build` compiled and prerendered all routes with no errors. |
| Development server routes | `/donations`, `/donate`, `/needs`, `/association` and `/admin` all returned 200 from the running dev server; signed-in flows were not exercised in this pass. |

## Design restoration, second pass — 2026-10-25

Status: implemented in the working tree on top of the API integration. Restored, within the current API contract and with no demo records: the My donations DataTable (status filters All/Drafts/Offered/Received/Withdrawn, search, Created/Status/Next-step columns, evidence rows with the staff decision, timestamp, staff note from offer events and history); donor matching heading "N associations need this" with the item/expiry subtitle, the "Why these associations?" panel from match budgets, redirect points (`GET /redirect-points`) and "Scan another item" on the no-match and sent states; dashboard KPI numbers counted client-side from loaded pages (`limit=100`, `+` when more remain), the medicine-flag banner over the first loaded pending offers' evidence, the near-capacity note and the active-needs progress panel; the slots month calendar with open/busy/full/closed dots, day panel and admin forms; all-category storage and daily-intake lists; the images gallery grid with indicator chips and expiry-bucket/FEFO side panels; the admin approvals DataTable with verification column; the needs two-column layout with open/paused counts; review queue offer ages, the donor-corrected-date evidence panel and the reception expected count. Voice input for need descriptions stays removed. Documentation contradictions for posted offers and company attribution were aligned (DESIGN.md, docs/design/README.md, requirements.md).

| Check | Result and boundary |
|---|---|
| Frontend lint and types | Passed: ESLint and `tsc --noEmit` with zero errors. |
| Frontend tests | Passed: 231 tests across 45 files with Vitest `--cache=false`, using mocked service boundaries. The images indicator test now covers the chip filter; donations, dashboard, slots, capacity, needs and reception tests pass unchanged. |
| Production build | Passed with the already-installed dependencies: `next build` compiled and prerendered every route with no type or lint errors. The registry restriction only blocks dependency installation, which this pass did not need. |
| Live backend acceptance | Not rerun; requests to the local API port remain blocked by the environment allowlist. Counts shown as `+`/loaded-page totals and the medicine banner only cover loaded pages, as documented. |

## Design restoration, 2026-10-25

Status: implemented and checked in the running frontend. The donor photo, indicator, matching and donation layouts, booking calendar and separate QR pass, association dashboard, review queue, reception workspace and stock detail layout again follow the chosen mockups within the current API contract. No runtime demo records, seeded data or simulated application actions were restored. Uploaded photo replacement/deletion remains unavailable because the API has no deletion command; local photos can be replaced or removed before an upload attempt.

| Check | Result and boundary |
|---|---|
| Frontend lint, types and tests | Passed on Node 24.22.0: ESLint, `tsc --noEmit --incremental false`, and 183 tests across 37 files with Vitest `--cache=false`. Tests use mocked service boundaries. |
| Regression checks | Failing tests preceded the fixes for the missing booking calendar, existing-draft load recovery, lazy stock evidence, and singular/enum wording. Booking tests also cover saved appointments whose QR retrieval fails. |
| Desktop and mobile browser | Current source served by the existing Next.js development server. Seven routes rendered at 1440 × 1000 and 390 × 844: donate, donations, booking, dashboard, review, reception and stock. No page errors or horizontal overflow. Also checked the dashboard empty state. Screenshots are local ignored artifacts under `.playwright-mcp/`. |
| Browser interactions | Passed: local photo preview/removal; Paris date/time selection, one booking submission and QR display; authenticated thumbnail loading, review category filters and approval checks; QR resolution followed by input-edit invalidation; mobile inline distribution details with one evidence read after expansion. All business API responses and identity were isolated browser fixtures. No real records were written. |
| Independent source review | Applied `optimize` and `refactor-review`. Review found an existing-draft load failure could create a different new donation; this is now blocked and the load can be retried. Stock evidence now loads only when the visible disclosure opens. No remaining consequential defect was reported. The named `review-agent` skill was unavailable. |
| Production build | Blocked: `next build --webpack` attempted from `/private/tmp/dono-design-build-dmb6ver8/frontend` using installed dependencies and synthetic public settings, excluding environment files. Execution was denied because `registry.npmjs.org` is outside the sandbox network allowlist. |
| Live backend acceptance | Not repeated in this pass. Requests to local API port 8000 returned the environment proxy's `blocked-by-allowlist` / `not_allowed_local` response. Its missing CORS header does not establish an application CORS defect. No CORS configuration was changed. Earlier live Auth/public-needs evidence below belongs to those earlier checks. |

Backend and database code were not changed by this restoration. Full donor-to-staff acceptance, real image analysis and physical camera/QR checks remain release gates.

## Public needs browsing, 2026-10-25

Status: implemented, with the public directory SQL applied to hosted Dono and live anonymous browsing verified. The real API returns an empty directory, and Nearby needs displays its empty state without a database error. Offering an item requires signup or sign-in and preserves the selected need, category and location. Authenticated matching rechecks that need before offering. Private reads and writes remain protected. Complete acceptance with published needs and account continuation remains pending.

| Check | Result and boundary |
|---|---|
| Frontend lint, types and tests | Passed on Node 24.22.0: 163 tests across 31 files. Mounted component and controller tests use mocked API/Auth boundaries. Covers anonymous search, detail selection, pagination, stale responses, retry, action-only account gate, safe continuation and preferred need matching across pages. |
| Backend Ruff and mypy | Passed; mypy checked 53 source files. |
| Backend pytest | 91 passed, 24 setup errors. Public HTTP contract tests passed with a simulated Supabase transport. All setup errors occurred before PostgreSQL assertions because process enumeration was blocked. Direct fresh `initdb` also failed because shared-memory allocation was prohibited. |
| Database acceptance | Three new real-PostgreSQL tests cover projection, grants, current season, active/approved sites, remaining demand, live/expired holds and distance/pagination. They are prepared but did not execute. |
| Production build | Did not pass. The existing `.next` output could not be removed due to filesystem permissions. An isolated source copy excluding environment files, with synthetic public configuration and installed dependencies, was blocked by npm registry network restrictions. |
| Browser verification | Initial checks showed the public controls and account gate but returned `database_unavailable`. After the hosted repair, a direct anonymous navigation to `127.0.0.1:8000/api/v1/public/needs?limit=10` returned `data: []` with valid pagination metadata. Refreshed `localhost:3000/needs` displayed the empty state without a database error. `/donate` previously showed signup/login links retaining category/location, and signup navigation rendered. Actual result rows, completed auth/confirmation and mobile layout were not verified. |
| Independent source review | No remaining actionable findings. Review caught and fixed silent retargeting when the selected need ranked beyond the first matching page. Applied `optimize`; SQL evaluates candidate demand before pagination, so larger-catalog performance remains unmeasured. The named `review-agent` skill is unavailable. |
| Migration preparation | [SQL payload](../supabase/changes/public_needs.sql) and [preparation script](../scripts/prepare-public-needs-migration.sh) are ready. Script syntax and stub-CLI checks passed for exact payload copy, repeat run, edited-file preservation and CLI failure. The installed Supabase CLI exits before creating a migration. The approved payload was applied manually to hosted Dono; the versioned migration now exists; history reconciliation remains necessary before the next CLI deployment. |
| Callback configuration | Local callback allowlist includes the fixed callback path with its continuation query. Hosted confirmation still needs the corresponding redirect entry and live verification described in [setup](setup.md#frontend). |

Next: generate and review the public needs migration with a working Supabase CLI, reconcile the manual hosted application with migration history, and run the PostgreSQL tests in an environment that permits database startup. Verify published result rows and account continuation. The existing draft workflow does not persist a preferred public need in the database; returning to an old draft from My donations restores item facts but has no preferred-need selection unless carried in its URL.

### Public directory outage follow-up

Read-only checks in the hosted Dono SQL Editor confirmed that `public.dono_public_needs(...)` was absent while the needs and associations tables existed. The hosted `postgres` role is not a superuser. The restricted function owner had no schema CREATE privilege, so deployment temporarily granted it for ownership transfer and restored the prior privilege within the same atomic block.

The [SQL payload](../supabase/changes/public_needs.sql) now supports reruns and preserves that prior permission. Independent source review found no actionable defects. Scoped Ruff and mypy passed. Three HTTP tests passed; five PostgreSQL cases, including two non-superuser redeployment cases, remain blocked at fixture startup by sandbox process restrictions.

The user explicitly approved the repair after the initial automatic approval rejection. The reviewed transaction then ran successfully in [Dono SQL Editor](https://supabase.com/dashboard/project/wivxerqtkeiflfoyanpp/sql/78334ae4-ec4e-4ab5-b48a-04e7da2cde98). It called the function as `service_role` before committing and notified PostgREST to refresh its schema cache. Post-application checks confirmed owner `dono_command_owner`, EXECUTE allowed for `service_role`, denied for `anon` and `authenticated`, and no schema CREATE privilege for the owner. No application records changed.

Live verification at 12:11 UTC on 2026-10-25 returned an empty successful public API page without a bearer token. The refreshed Nearby needs page on `localhost:3000` displayed “No open needs match this search” instead of the database error. This verifies the real backend-to-hosted-database connection and the browser empty state; it does not substitute for the blocked fixture tests or a journey using published needs. Manual SQL Editor application created no CLI migration-history entry.

## Earlier deployment preparation, 2026-10-25

| Check | Result and boundary |
|---|---|
| Frontend lint, types and tests | Passed on Node 24.22.0; 149 tests across 29 files. Browser file selection and API helpers test exact 4 MiB acceptance and +1-byte rejection with mocked API/FileReader boundaries. |
| Backend Ruff and mypy | Passed; mypy checked 52 source files with the installed supported Python environment. |
| Backend pytest | 88 passed, 18 setup errors. The remaining tests require embedded PostgreSQL; the sandbox blocks `psutil` process enumeration before the database starts. The two mock-HTTP boundary tests passed after reproducing the former oversized-file acceptance. |
| Independent source review | No actionable findings in deployment configuration, command sequence, SQL privileges/data preservation or boundary handling. Applied `$optimize` to photo persistence; no runtime performance measurements were taken. `$review-agent` was unavailable. |
| SQL payloads | Photo SQL preserves historical evidence and limits new writes. The original Auth schema grant was ineffective on managed Supabase and is superseded by the private helper migration described below. Real PostgreSQL boundary and preservation checks did not run because of the fixture restriction. |
| Migration preparation script | Bash syntax and isolated stub-CLI checks passed: exact SQL copy, repeat execution, preservation of an edited migration and CLI failure. The CLI was unavailable during initial preparation; it is now installed. The preparation script now copies only the photo-policy payload, because Auth repair has its own migration. |
| Production build | Blocked by npm registry network policy. Attempt used current copied frontend source, Node 24.22.0, real installed dependencies and synthetic public configuration without environment files. |
| Browser check of deployment changes | Could not start the isolated frontend on `127.0.0.1:3097`: `listen EPERM`. Component tests do not replace a deployed browser check. |
| Live signup diagnosis | Supabase Auth signup/sign-in succeeded, but profile loading failed. First the browser origin differed from `APP_ORIGIN`; then hosted logs showed missing `USAGE` on `auth` for `dono_command_owner`. A fresh query confirmed that hosted `postgres` cannot grant that usage. The earlier grant recommendation was insufficient. The approved private-helper migration was then applied successfully and verified in the live app. |
| Vercel account and runtime | Not linked or deployed. Root directories, environment settings, bundle size, duration and full-size photo upload/read need verification on Vercel. |

Backend pytest ran from `/private/tmp` with a clean environment and `SSL_CERT_FILE=/etc/ssl/cert.pem`, using the repository virtual environment and `-p no:cacheprovider --tb=no`. It did not load local environment files. Earlier certificate/process errors are environmental; the final run had no assertion failures. The 96-test backend result below belongs to an earlier revision.

The pending photo SQL lives in [supabase/changes/vercel](../supabase/changes/vercel/). [The preparation script](../scripts/prepare-vercel-migrations.sh) uses `supabase migration new` to create a versioned migration. Historical migration files remain unchanged. Before production cutover, inspect migration history, run the SQL tests in a permitted environment, apply the reviewed update, and check for legacy photos above 4 MiB. See the [deployment commands](setup.md#vercel).

## Hosted Auth follow-up

Live read-only checks on 2026-10-25 found `auth` owned by `supabase_admin`, with `postgres` lacking `USAGE WITH GRANT OPTION`. The custom command owner still had no schema usage. Direct grants cannot fix this managed-schema restriction. The localhost API health response was healthy, and a fresh authenticated frontend tab reproduced `Database unavailable` during profile bootstrap.

The supported repair uses private `postgres`-owned helpers for the request user ID and the Auth-user existence check, callable only by `dono_command_owner`. The profile command and four existing RLS scope helpers retain their signatures and restricted owners. Direct browser-role policies continue to call `auth.uid()`, because the built-in `authenticated` role already has schema usage. [Supabase guidance](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema).

Live prerequisites confirmed that the helper names do not exist, `postgres` can create functions in `private` and read `auth.users`, and `authenticated` can use `auth`. The CLI-generated [managed Auth bridge migration](../supabase/migrations/20261025115658_managed_auth_bridges.sql) and four dedicated SQL tests are present. Scoped Ruff/formatting and mypy pass, with 53 source files checked. The latest full backend suite has 91 passed and 23 PostgreSQL fixture errors; no assertions failed. Concurrent public-needs changes cause unrelated full Ruff errors. Independent source review found no actionable Auth bridge defect. The user approved application, and the exact migration ran successfully inside a transaction in Dono SQL Editor. A fresh localhost session loaded the account page and membership state, then the protected donation list displayed its empty state without error. Catalog checks confirmed both helpers are owned by `postgres`, use `SECURITY DEFINER` and an empty search path, allow the command owner, and deny direct execution to `anon`, `authenticated` and `service_role`. No records were deleted and no managed ownership changed.

This was a manual SQL Editor application, so no CLI migration-history entry was created by this action. The source migration is rerunnable; inspect and reconcile history before the next `db push`. Live donor profile/bootstrap and list access are verified; full staff, photo and QR workflows remain separate gates.

## Delivered

- [frontend/](../frontend/): Supabase email/password signup and sign-in, authenticated API transport, paginated collection reads and donor/association/platform workflows. Stable command keys and recovery handle lost donor-save and booking responses without fabricating success.
- Frontend review fixes: extracted donation workflow controller, shared category fields and labels, separate SDK identity and application access, cancellation of superseded reads, viewport-triggered photo loading, expandable offer history and submitted gallery text filters. Mounted React tests cover lifecycle behavior with mocked service boundaries.
- [backend/](../backend/): FastAPI composition, strict Pydantic DTOs, Auth/authorization, domain services and adapters. This change adds process liveness at `/health` and guarded booking restoration through `/api/v1/offers/{offer_id}/booking`.
- [supabase/migrations/](../supabase/migrations/): 15 ordered migrations, 21 app/private tables, named enums, PK/FK/indexes/constraints, RLS, immutable original/history guards and atomic commands. [config.toml](../supabase/config.toml) selects PostgreSQL 17 and disables Storage and automatic seeding. Historical migration files and remote records remain unchanged; the pending deployment SQL is described above.
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

## Invariants covered by the inherited backend evidence

- AI extraction/indicators never decide approval/refusal; only authorized staff set the write-once offer decision. Late AI cannot overwrite human corrections or resource/decision state.
- Dates, PAO calendar arithmetic, exclusive buckets, strict-date checks and deterministic total FEFO run in Python at read/command time. Derived expiry values are absent from stored source facts and command audits.
- Matching is deterministic need + independent demand/storage/intake/place budgets + season + Haversine, with no model call. Resource mutations serialize through association locks and recheck live commitments.
- Stable donations are reusable after refusal; historical offers freeze facts/evidence, one active attempt at a time. Finite review/approval/receipt windows, withdrawal, cancellation/no-show and reconciliation release unreceived holds without a scheduler.
- Original analyses/indicators and photo digests/provenance remain separate from edited attributes/source dates. Photos persist as private canonical base64; lists contain authenticated content URLs, never payloads. No Storage SDK/bucket.
- Auth metadata cannot elevate roles. Association registration starts inactive; platform approval activates original applicant; last-admin transfer/revocation/recovery is audited. Membership-scoped RLS and guarded server capabilities apply.
- Medicines remain ineligible; staff must assert not-medicine, with original warnings preserved. Individual food requires room-temperature, nonperishable source facts and explicit staff eligibility assertion. No transport, routing, donation notification emails or messaging implementation; optional account confirmation is handled by Supabase.

## Remaining release gates

1. Apply migrations to a chosen development Supabase project and verify managed ownership/grants, actual Data API/RPC restrictions, email/password signup, sign-in and optional confirmation redirects and current security/performance advisors. No remote provisioning or full Docker-stack run was performed.
2. Select/configure OpenAI model/credential and execute live strict-schema smoke tests for all five categories. Supply and evaluate 25–35 real photos including medicines and para products. Model quality/calibration remain unmeasured.
3. Decide photo/audit retention (AMB-015); configure deployment request-body/spool limits, rate/cost budgets and measure performance/mobile behavior (AMB-019). Multipart parsing precedes endpoint image-size validation.
4. Run the remaining PostgreSQL tests in an environment that permits local processes. Then verify the connected Next.js journey with real donor and association accounts: email/password authentication → photos/analysis/manual edit → offer → staff review → booking/QR reload → reception → distribution. Unit/component tests use mock API boundaries and do not establish this acceptance.
5. Configure two Vercel projects with Root Directories `frontend` and `backend`. Apply the prepared SQL, check historical photo sizes, and verify exact-origin CORS, confirmation redirects, full-size upload/read and mobile behavior. No project link or deployed configuration has been verified. See [setup](setup.md#vercel).

Unmatched posts, company attribution and stricter historical demo policies remain documented [product/API gaps](requirements.md#backend-integration-differences). Their unsupported actions are not simulated. Jev/hybrid and optional analytics remain deferred under the 40-hour scope.

Recommended order: current backend checks → Supabase/Auth deployment validation → connected required flows and live OpenAI/photo evaluation → mobile acceptance and deployment limits. Details are in [handoff](handoff.md).

## Integration verification before email/password replacement

These checks ran on the uncommitted integration changes above `502dd64`, on 2026-10-25. Frontend commands ran from `frontend/` with the installed real Supabase SDK 2.112.3 and jsdom 26.1.0; no type stubs were used.

| Check | Result and boundary |
|---|---|
| ESLint | Passed with the existing installed binary. |
| TypeScript | `tsc --noEmit` passed. |
| Vitest | 136 passed across 28 files; controller tests, isolated UI fixtures and mounted React lifecycle tests with mocked API/auth boundaries. |
| Production build | Passed with Next.js 16.4.2/webpack and Node 25.9.0 in `/private/tmp/dono-reviewed-build-mlxnwoxa/frontend`, copied without environment files and using the installed dependencies. This verifies compilation, not configured services. |
| Python syntax and TOML | Four changed Python files parse; backend and Supabase TOML parse; automatic seed is disabled with no seed paths. |
| Backend Ruff/mypy/pytest | Did not run: only Python 3.9 and 3.14 are installed; the project requires 3.12/3.13. The earlier supported-runtime download was denied by network policy. |
| Source review | Independent review found no actionable issues after the frontend architecture, maintainability and loading fixes. Earlier integration findings were also resolved, including lost-save response recovery, concurrent edits, photo revision accounting and stock confirmation reset. No runtime performance measurements ran. |
| Browser/runtime | Could not start the built frontend: localhost port binding returned `listen EPERM`, including an elevated attempt. |
| Environment/live services | Existing `.env` reads are explicitly denied to this session. No live Auth, API, Supabase, OpenAI or QR journey was verified. |

The initially missing Supabase and jsdom dependencies are now installed and resolved in the lockfile. Historical merge-only frontend results do not establish current integration behavior.

## Email/password replacement verification

On 2026-10-25, the latest request replaced Google login with email/password signup and sign-in. No backend source, migrations, installed dependencies or hosted accounts changed in this task.

| Check | Result and boundary |
|---|---|
| Lint and TypeScript | Installed ESLint and `tsc --noEmit` passed. |
| Tests | `node node_modules/vitest/vitest.mjs run --cache=false`: 146 passed in 29 files. The 13 focused auth tests cover SDK arguments, confirmation-required signup, immediate sessions, pending profile/membership gates, wrong passwords, validation, duplicate requests, retry/sign-out and account changes. SDK/API boundaries are mocked. |
| Supabase configuration | Python 3.14 `tomllib` parsing and assertions passed for enabled email signup, minimum password length eight, local confirmation disabled, exact callback allowlist and disabled external providers. |
| Independent review | No actionable findings in scoped auth code, configuration and rules. Installed SDK 2.112.3 source confirms session events and automatic PKCE callback exchange. |
| Production build | Blocked by network policy on `registry.npmjs.org`, including an elevated attempt. Next.js 16.4.2 starts its security-version lookup before compilation. The isolated source copy at `/private/tmp/dono-email-auth-check-phsavmay/frontend` excludes environment files and uses real installed dependencies with synthetic public configuration. No current build success is claimed. |
| Browser | Current isolated frontend could not bind `127.0.0.1:3096`: `listen EPERM`. No browser or visual check ran. |
| Hosted Auth | Not run. Hosted Email/Google settings, confirmation delivery and login against the real FastAPI service remain deployment checks in [setup](setup.md). |

Existing Google-only accounts were preserved. They need a password set through a trusted Supabase account-recovery process before using the new login form. Historical diagram exports still show the former provider; [architecture](architecture.md) marks that discrepancy because their editable JSON sources are absent.

## Frontend dependency upgrade, 2026-10-25

The requested frontend dependency upgrade is partial. TypeScript changed from 5.9.3 to 6.0.3 in `frontend/package.json`, the generated lockfile and the local installation. No application source or backend dependencies changed. The installed typescript-eslint 8.72.0 supports TypeScript `>=4.8.4 <6.1.0`, so TypeScript 7 is outside this toolchain's supported range.

| Check | Result and boundary |
|---|---|
| Baseline | Node 24.22.0: ESLint, TypeScript 5.9.3 and 146 tests passed. |
| Upgraded dependencies | Real offline installation with pnpm 11.0.9; TypeScript 6.0.3 confirmed. No substituted packages or type stubs. |
| Lint, types and tests | Passed in an isolated source copy without environment files: `eslint .`, `tsc --noEmit` and `vitest run`; 29 files, 146 tests. Service boundaries remain mocked. |
| Independent review | No actionable findings in the TypeScript manifest and generated lockfile changes. |
| Production build | Next.js 16.4.2 started with webpack and synthetic public configuration, then registry access was denied. No completed build is claimed. |
| Remaining upgrades | Online npm metadata and the elevated upgrade command were denied access to `registry.npmjs.org`. Offline jsdom 30.1.3 installation also failed because `@asamuzakjp/dom-selector@10.0.5` was absent from the cache. Failed attempts stayed in an isolated directory; other direct dependency pins remain unchanged. |

Resume the remaining upgrades when npm registry access is available. Keep the manifest and lockfile synchronized, check package peer constraints, and rerun the required frontend checks after those upgrades.

## Location validation fix, 2026-10-25

The reported request used `location=68`. A live [IGN search](https://data.geopf.fr/geocodage/search?q=68&index=address&limit=1) returned HTTP 400 because the query needs 3–200 characters and must start with a letter or number. Dono previously mapped this to the retryable `geocoding_unavailable` error. The shared adapter now validates trimmed input before calling IGN and returns `422 invalid_location`, with `retryable: false`. The public form shows an inline correction message and a full postcode example. Blank searches still browse without geocoding. Distance ordering and category filtering are unchanged.

| Check | Result and boundary |
|---|---|
| Regression tests | Four backend cases reproduced the incorrect 503 before the fix; 25 targeted backend tests now pass. Frontend tests reproduced invalid requests and missing error mapping; 23 targeted tests now pass, including correction, whitespace, postcode and accented-town cases. External transports are mocked. |
| Frontend checks | Node 24: lint, typecheck and 227 tests in 44 files passed. One later recovery test passed in the final targeted run. |
| Backend checks | Ruff passed; mypy passed for 53 source files. Full pytest returned 93 passed, two API setup failures caused by the injected SOCKS proxy, and 26 PostgreSQL fixture errors caused by denied process inspection. All four API tests then passed with proxy variables unset for these in-process tests. No application proxy settings changed. Database tests remain unverified. |
| Live browser | Reloaded `localhost:3000/needs` displayed the new hint. Submitting `68` retained the input, focused it and showed the inline correction. Submitting `68100` loaded distance-ordered results, with the existing Mulhouse fixture at 1.1 km before Paris at 387.3 km. A direct request to the running backend for `68` returned `invalid_location` with `retryable: false`, confirming it runs the changed code. Paris also returned results through the real geocoder and configured database. No records were created or changed. |
| Independent review | No actionable source findings in the scoped validation, shared callers, accessibility and tests. The `optimize` review found no extra upstream calls or supported performance issue. The unavailable `review-agent` skill was not applied. |
| Production build | Both the normal build and direct installed Next.js CLI were blocked by the environment's `registry.npmjs.org` access restriction. No completed production build is claimed. |

## Public locality filtering, 2026-10-25

The user clarified that searching a town must exclude associations from other towns. This replaces the earlier public directory's distance-only behavior. Public search now restricts IGN lookup to municipalities, passes the canonical town or exact five-digit input postcode to a new database function, and filters before pagination. Search and category changes also reset the selected need. Authenticated donation matching retains its existing rules.

Live integration exposed a second provider issue: unrestricted IGN search for `Mulhouse` selected a street in Riedisheim. [Municipality lookup](https://data.geopf.fr/geocodage/search?q=Mulhouse&index=address&type=municipality&limit=1) returned Mulhouse correctly. The adapter requests that type only for public discovery and rejects unexpected non-municipality results. Ordinary address lookup is unchanged.

| Check | Result and boundary |
|---|---|
| TDD | Backend tests reproduced missing locality arguments and the Mulhouse/Riedisheim result. Frontend tests reproduced retained item selection after search/category changes. Final focused backend tests: 37 passed with mocked transports. |
| Frontend | Lint, typecheck and all 230 tests in 44 files passed. An initial typecheck overlapped the build's generated-type cleanup; it passed when rerun after the build stopped. |
| Backend | Ruff and mypy passed for 53 source files. Final pytest: 107 passed and 35 PostgreSQL fixture setup errors from denied `sysctl` process inspection. Proxy variables were unset only for this in-process test run. No test assertions failed. |
| Hosted SQL | Applied the exact reviewed [payload](../supabase/changes/public_needs_location.sql) inside a transaction through Dono SQL Editor. The new function returned five existing needs for Mulhouse, five for Paris, five for postcode 68100, and ten for blank search. One-row pagination retained the locality restriction and correct `has_more` values. No association, donation or need records were created or changed. |
| Privileges and accented labels | Verified owner `dono_command_owner`, `SECURITY DEFINER`, empty search path, execution allowed for `service_role` and denied for `anon`/`authenticated`. The target database parsed `42000 Saint-Étienne` and normalized the town to `saintetienne`. Connected advisor tools lacked project permission; no complete advisor run is claimed. |
| Browser and real providers | Confirmed the updated hint in the running checkout. Mulhouse and 68100 each displayed only Mulhouse needs. Enter submitted the postcode search. Adding Food showed one Mulhouse food need. Paris plus Food showed only Paris. Clearing location restored both towns without distances. Requests used the running FastAPI backend, real IGN service and configured hosted database. The unchanged existing demo records supplied the results. |
| Review | Architecture and code reviews found no actionable blocker. The `optimize` review found no extra provider calls or supported performance issue. Existing address labels are used conservatively: malformed labels are excluded from location searches; identical normalized town names in different areas remain indistinguishable without structured locality data. |
| Build | The workspace build hit an EPERM while cleaning `.next`. An isolated source copy excluded environment files and used real installed dependencies with synthetic public build configuration. Its direct Next.js build was blocked by npm registry network policy. No production build passed. |
| Migration tracking | The installed Supabase CLI exits with status 1 and no output, including help. The SQL payload was deployed manually. The timestamped migration now exists; history reconciliation remains pending. The preparation script supports `public_needs_location`; the test database fixture applies the payload until the migration exists. See [setup](setup.md#supabase-deployment-prerequisites). |

## Dernière exécution API

Voir le [rapport du 25 octobre 2026](reports/api-tests-2026-10-25.md) : **97 tests réussis**, **130 vérifications HTTP curl + 17 scénarios de dates**, couverture combinée **91.56 %**. Cette campagne utilise PostgreSQL réel temporaire et des transports Auth/Supabase/OpenAI/BAN simulés. Les valeurs précédentes de ce document restent le bilan historique ; les validations hébergées restent à faire.

## Vérification réelle des services

La campagne [Supabase/OpenAI/BAN du 25 octobre 2026](reports/live-integrations-2026-10-25.md) a ensuite utilisé backend/.env : Auth et Data API Supabase répondent en HTTP 200, les 22 noms de fonctions Dono correspondent aux migrations locales, Google est activé, et un appel OpenAI Vision gpt-5.4-mini réussit avec validation analysis-v1. BAN réussit également. Aucune écriture hébergée. Le parcours OAuth/métier avec utilisateurs réels et l'évaluation photo restent non validés ; les mentions antérieures d'absence totale d'appel réel sont désormais historiques.

Le nouvel [appel avec entrée/sortie conservées](reports/openai-example-2026-10-25/README.md) répond HTTP 200 mais échoue à la validation métier (deux indicateurs requis absents). Connectivité confirmée ; fiabilité contractuelle des réponses réelles non acquise. Le backend rejette cette sortie avec provider_invalid_output.
