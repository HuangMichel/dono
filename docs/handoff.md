# Handoff

Updated: 2026-10-25

## Goal

Implement only the frontend with dummy data, following the API contract and chosen mockups. The user authorized this frontend implementation after the earlier documentation task; the backend remains excluded.

## Status

| Item | State | Notes |
| --- | --- | --- |
| Confirmed product rules | complete | Recorded in [AGENTS.md](../AGENTS.md) and the [decision register](requirements.md#ambiguities-and-decisions-required). |
| API and database contracts | baseline complete | Company attribution, identical-unit groups, Europe/Paris, unopened packaging, frozen need criteria and one corrected full reception. Reception refusal and unmatched posting are frontend-only extensions pending future API contracts. |
| Static mockup reconciliation | complete | AI wording, booking selection before QR, staff packaging confirmation, reception quantity and smaller company flow. |
| Diagram sources | complete | Seven sources recovered from Git history and reconciled with current contracts. See [architecture evidence](architecture.md#validation-evidence). |
| Diagram rendering/validation | partial | Six supported views generated with static checks in a temporary mirror; browser checks failed. Installed renderer does not support ERD. |
| Frontend demo | partial verification | Five review findings fixed: approval selection, registration continuity, storage feedback/recovery, accessible field names and company product validation. Earlier UI features preserved. Frontend only; [current decisions](requirements.md#current-frontend-decisions--2026-10-25). Formatting, lint, typecheck, 134 tests and 20-route build pass. Fresh browser checks, disk picker and microphone remain unverified. |
| Backend and database | not started | Explicitly outside this task. No API, migrations, provisioned services or photo evaluation set. |

## Uncommitted work

- Root guidance, README and docs specifications reflect the confirmed decisions.
- DESIGN.md and docs/design/ were already untracked before this task; their existing work is preserved with targeted edits.
- docs/architecture/ contains restored JSON sources and regenerated supported diagrams/evidence.
- .gitignore no longer excludes architecture source JSON files.
- frontend/: Next.js UI, contract-shaped dummy data, local state, tests and pinned pnpm dependencies; no API handlers.
- README.md, AGENTS.md and docs/setup.md now distinguish the runnable demo from planned service integration.

## Verification

| Check | Command or method | Result | Environment |
| --- | --- | --- | --- |
| API/database and mockup review | Independent business review plus source checks | Corrected staff audit attribution, explicit packaging verification and company photo prerequisites. | Current working files |
| Documentation integrity | Read-only Python checks and git diff --check | 12 Markdown files have no broken file/heading links; 51 requirements mapped, 15 use cases and 76 acceptance criteria unique; 15 API JSON examples and seven restored sources parse. | Current working files |
| Diagram source recovery | Git objects from 70bd4f7, then current-contract reconciliation | Seven editable sources restored; historical bytes are not claimed as exact current sources. | Local checkout |
| Supported diagram generation | Archify finalize in isolated /private/tmp mirror | Validation, delivery and strict artifact checks passed there; browser gate failed. | Installed Archify 3.0.1 |
| Workspace diagram provenance | Strict check after copying unchanged bytes | Fails because receipt identity belongs to temporary generation paths/inodes. | Current checkout |
| Frontend checks | pnpm format:check; pnpm lint; pnpm typecheck; pnpm exec vitest run --fsModuleCachePath /private/tmp/dono-review-fixes-vitest --no-cache | Passed, 134 tests in 16 files. | Current frontend source, Node 25.9.0, pnpm 11.0.9 |
| Production build | next build --webpack | Passed, 20 routes including signup and dynamic booking; all 84 source/asset files byte-identical to the temporary mirror. | /private/tmp/dono-review-fixes-final-2vber7qj; same dependencies; workspace rebuild blocked by generated-directory EPERM |
| Independent frontend review | Source, API and selected-mockup review; saved screenshot inspection | Reported dialog, match layout, reception lookup/history and styling defects corrected. Shared-component boundaries reviewed. | Source plus independent inspection of 34 static captures |
| Compiled browser pages | Browser request interception serving build artifacts | 17 static routes at desktop/mobile, no document overflow or uncaught page errors; donor draft-to-offer and staff approval, cross-date reception lookup passed. | No listening server; not Next.js server acceptance |
| Booking and receipt preview | Unchanged booking client wrapped in temporary fixture prerendering | Slot selection, saved-booking QR recovery, reduced reception 6 to 2, distribution 1 leaving 1 passed. | Earlier fixture component preview |
| Current frontend interactions | Chrome against existing Next.js development server | Table search/sort/selection; desktop/mobile navigation; calendar Today/keyboard controls; full slots hidden; date change clears time; dynamic booking and QR failure/retry passed. Registration/photo stepper checked. | Changed source served live; test booking on separate 127.0.0.1 origin preserved localhost data |
| Current independent review | Read-only code_reviewer review with refactor-review and ui-ux-pro-max | Calendar border finding fixed; final narrow recheck found no actionable defects. | Current source; parent owns browser checks |
| Registration and table corrections | Live Chrome desktop/mobile; independent source review | Row pointer/keyboard selection, separate detail actions and equal search/table width passed. Identity validation, optional address, Back/Next, SIRET-only pending submission and review details passed. Nearby filters/layout passed. | Current Next.js demo; separate 127.0.0.1 test origin; no browser errors after fresh load |
| Signup, upload and modal corrections | Live Chrome responsive checks; independent source review | Signup navigation, one selected row, fitted details, upload sample layout, dialog centering/internal scrolling, Escape/X rollback and Save persistence passed. | Current Next.js demo; desktop, 768 px, 375 px and short-screen checks as applicable |
| Navigation, reception and Needs | Live Chrome desktop/mobile; independent code review | Icon rail/counts, collapse-to-mobile navigation, preserved receipt input and reduced reception, lookup focus, direct row editing, Pause/Save and sample draft review/publish/discard passed. No fresh-load browser errors. | Current Next.js demo at 127.0.0.1; 35 tests and 20-route build in /private/tmp/dono-nav-voice-build-l0ub1rkh |
| Photo gallery, refusal and filter cleanup | Independent source review; live Chrome at 375/768/1280 px; 67 tests; production build | Main photo, append/remove/cap, review/back, aligned steps/actions; refusal reason/confirmation/reload, preserved history, released slot, unchanged stock and donor terminal booking passed. Duplicate Category and FEFO UI removed. | Current source; /private/tmp/dono-photo-refusal-final-0qm6f1jj; separate 127.0.0.1 demo origin |
| Selection, capacity and form feedback | Independent source review; live Chrome desktop/375 px; 100 tests; production build | Row check/color, single selection, capacity colors/Paused, required and disabled fields, SIRET rejection/normalization, pending registration, external footer submission and mobile spacing passed. No browser warnings/errors. | Current source; /private/tmp/dono-forms-capacity-final-dnorl5xs; separate 127.0.0.1 demo origin |
| Unmatched offer posting | Independent source review; live Chrome desktop/375 px; 115 tests; production build | Posting/reload, donor Posted filter, association search/categories, keyboard selection, saved date and withdrawal to editable facts passed. Listing removal passes store tests; last gallery reload was blocked when preview stopped. | Final source; /private/tmp/dono-posted-offers-final-o3ry_ntf; separate 127.0.0.1 demo origin |
| Five frontend review fixes | Independent code_reviewer review with optimize/refactor-review; component-flow mocks, static rendering and substitute Storage tests | No actionable review findings. Approval selection/clear/filter, inline registration persona with retained fields, trimmed product validation, explicit field names, storage failure/recovery and protected unread snapshot checks pass. | Current source; mocks and SSR do not prove native browser behavior |

## Not verified

- Fresh browser acceptance for the five review fixes: Playwright transport is closed, no preview is listening, and earlier restart attempts failed with `listen EPERM`. Native focus/keyboard, responsive layouts and actual browser storage failures remain unverified for this change.
- Documentation link check found the existing `architecture/candidate.json` reference in `requirements.md` has no target. The same reference exists at HEAD. It is unrelated to these frontend fixes; the historical documentation-integrity result above does not verify this current link.
- Final gallery reload after withdrawal and fresh-browser image-loading recheck: preview stopped, and both normal and escalated restart attempts failed with `listen EPERM`. Earlier live posting/browsing and withdrawal-to-draft passed. Store tests cover listing removal.
- Actual microphone capture, speech permission denial and browser speech-service responses: source-reviewed only. Typed descriptions and fixed sample draft behavior were checked live. No application API or AI provider was added.
- Disk-file choose/replace and invalid-file rejection in the shared upload control: extension file-URL access was unavailable and native picker control was denied. No browser permissions changed. Sample previews and existing validation source were checked.
- Target-device behavior: desktop Chrome responsive checks cover the changed UI; physical devices were not tested.
- Final warning-state rendered recheck: the earlier browser transport closed. Source reviewed and rebuilt; native-progress colors were subsequently verified live.
- Database/RLS, live API/provider, concurrency and camera/signed QR behavior: no service implementation or fixtures exist.
- Complete keyboard, screen-reader and device accessibility acceptance: not run. The correction dialog has a verified accessible name and received browser interaction checks.
- Current ERD rendering: installed Archify does not support the erd type; existing HTML is a historical 153-column view, while restored source/dictionary have 154 columns.
- Browser diagram checks: Chrome communication failed. Historical captures do not validate changed diagrams.

## Blockers

- Medicine policy refinements and approval reservation/release rules are on standby at the user's request. Existing medicine exclusion remains.
- AUD-004 / AMB-004: define basis adoption when a first analysis finishes after a human edit, without overwriting that edit.
- AMB-001/002: choose sign-in without email and trusted membership/bootstrap behavior.
- AMB-003/005/006/009/010/013: remaining upload, expiry-boundary, matching, slot and QR exception policies need decisions before dependent implementation.
- AMB-015/019: retention, target devices and operational limits remain open.
- Production publication, public visitor discovery, association claiming and stock disposal remain unresolved. The frontend supports only explicitly posted unmatched items for association browsing.
- Re-estimate the required flow before implementation; the illustrative 40-hour allocation contains no optional savings.

## Next step

1. Review the remaining [decision register](requirements.md#ambiguities-and-decisions-required) without advancing standby topics.
2. Restore a working browser validation environment and ERD-capable renderer before claiming current diagram visual/provenance acceptance.
3. Verify disk-file uploads with a permitted file picker. Complete remaining warning-state and target-device accessibility checks when that scope is requested. Live dynamic booking routing and native-progress colors are verified. Backend integration still needs separate authorization and unresolved policy decisions.
