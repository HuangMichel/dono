# Dono frontend demo

Next.js App Router, TypeScript, Tailwind and shared shadcn-style controls. Data and actions are browser-local simulations based on [the API contract](../docs/api.md), with the explicitly requested [frontend demo extensions](../docs/requirements.md#current-frontend-decisions--2026-10-25). No backend or API endpoints are implemented.

## Run

Use pnpm 11.0.9 and a compatible Node.js release. Checks in this workspace used Node.js 25.9.0.

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. No environment variables, passwords or service accounts are needed. Webpack is explicit in the development and build scripts. Dependencies and the lockfile were prepared from the existing local package cache; three transitive pins in `pnpm-workspace.yaml` keep that installation reproducible.

## Design and components

Layouts follow the selected [mockups](../docs/design/README.md). [DESIGN.md](../DESIGN.md) controls semantic colors, typography, widths and accessibility. Public/donor pages and association/platform pages share buttons, fields, cards, chips, headings and icons from `components/ui`. Button variants use Radix Slot and class-variance-authority; `components.json` records the shadcn configuration.

The frontend includes the donor scan, analysis, correction and offer states; split public/auth screens; the staff review queue; the monthly slot calendar; reception; stock; and platform approval. Browser-local reception refusal and unmatched-offer posting are explicit demo extensions. Other API-unsupported actions remain unavailable. Mockup example statistics are replaced with fixture-derived values or explicit unavailable states.

Shared `DataTable` controls provide search, column sorting and single-row selection for donations, needs, stock and platform approvals. Click a row background or press Enter/Space on a focused row to toggle selection. Selecting another row replaces the previous selection. Detail buttons and other row actions remain independent. A stronger green background marks the selected row; its checkmark aligns with the first text line on desktop and mobile. Expanded evidence wraps within the table width. The search field has a leading icon and sits above the bordered table at the same width. The shared `Calendar` starts on today in Europe/Paris, supports keyboard navigation and has a Today control. Donor booking hides past, closed and full slots; the Where dropdown contains the approved association's address. The console places the profile at the top left and provides a navigation toggle. Registration and item photography use the same `Stepper`. Their Back and Continue actions use a separate shared footer below the step content.

The console navigation shows shared icons and count chips for waiting reviews, expected drop-offs, remaining stock items, active needs and pending platform approvals. Collapsing it keeps a narrow icon rail with accessible labels. Mobile navigation retains full labels. Reception cards have compact More details/Hide details controls; hiding a card preserves its entered quantity. Selecting a Needs row opens its editor directly. Deselecting, cancelling or saving clears that selection.

On Needs, Describe a need supports browser voice input and a typed description. Use sample fills the supported fictional description. Prepare sample draft loads editable fields without saving; Confirm and publish need is the staff action that creates the need. Arbitrary descriptions do not produce simulated AI results. The original sample transcript is retained in `source_text`. No model or application API is called. Browser speech recognition has limited availability and may process audio through the browser's speech service; see [SpeechRecognition documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). The microphone starts only after Record description is pressed, and recording ends on stop, editing, errors or leaving the page.

The photograph step uses shared `FileUpload` controls for multiple item views and a separate optional label. Batch and successive selections append to a gallery with individual replacement, removal and main-photo selection. The demo allows six item photos plus one label, with JPEG/PNG/WebP and signature validation and a 5 MB limit per file. Invalid files have filename-specific errors; stale reads cannot restore removed or replaced previews. The selected main photo and gallery remain through review and Back to photos. The three equal step columns, upload area and action button share one width. Thumbnail filenames and action rows align; mobile upload cards stack. Its icon-only Back arrow returns to `/donate` without deleting the saved draft. The donation start page has a Back arrow to `/`. Each page shows one 44 px Back control, above the heading on desktop and in the header on mobile. These links work on direct entry without relying on browser history. Donor and registration step buttons show left arrows before backward-action labels and right arrows after forward-action labels. Review step buttons stack on mobile. Local image previews remain temporary. The correction dialog is centred with internal scrolling when needed. Escape and Close discard unsaved corrections; Save keeps them.

The sign-in page links to `/signup` through Create a donor account. Both pages share `AuthLayout`. Credential fields remain disabled; Continue as a demo donor opens the existing fictional donor flow without creating an account or collecting a password.

## Explore the demo

1. Open `/login` and choose the donor persona.
2. Create a draft at `/donate`. Open Sample controls to choose a scenario. Scan an item, add a local image preview or use the illustration, then run sample analysis. The fixed sample description creates two separate drafts; arbitrary text is not parsed.
3. Correct working details and send an offer. Original indicators remain separate. Medicine and chilled-food scenarios retain their warnings.
4. Switch to the association persona at `/login`. Review the offer at `/association/review` and make an explicit staff decision.
5. Return to the donor persona. Open `/donations`, book an approved item and view its demo pass. The QR failure control preserves the booking.
6. Switch to the association persona. Paste the displayed `DEMO-ONLY:` reference at `/association/reception`. Confirm a positive quantity no greater than the offered quantity, or refuse the entire unreceived donation with a reason and explicit staff confirmation.
7. Distribute received stock at `/association/inventory`. Remaining quantities update from the local movements.

Refusal at reception creates no receipt or stock movement. It preserves the offered quantity, original approval and booking history, releases provisional need/capacity holds and slot occupancy, and prevents later receipt or rebooking. Donors see the staff reason. Direct booking pages show closed history without a QR. The browser-local `reception_refusals` records survive reload; older saved state initializes this collection without a reset. No refusal endpoint or public DTO was added.

When no association currently matches, Post offer makes the analyzed item available in the association's Offers nearby view. The donor sees Posted in My donations and can withdraw the post to edit the preserved draft. The listing contains item facts, sample indicators and a labelled sample illustration, without private donor details. Uploaded photo previews remain temporary and do not appear in the persisted listing. Posting does not assign a recipient or create an approval, reservation, appointment or stock movement. Medicine and chilled-food warnings still block posting. Claiming remains unavailable. This is a browser-local extension with no publication API.

Capacity cards and the dashboard share a percentage meter computed from stock plus reservations against the limit. Green covers values through 60%, orange covers values above 60% through 85%, and red covers values above 85%. A zero limit remains a neutral Paused state.

The console also provides needs, capacity, slot and image views. Duplicate Category dropdowns under More filters and FEFO/distribute-first controls and panels are removed. Main category controls, source dates, indicator filters and ordinary stock distribution remain. `/company` records a company name on a donor-owned donation. `/register-association` has three steps: Identity, Donation address and Review. Identity requires a name and at least one separate RNA or SIRET reference. Missing required fields show a red border, a light red background and linked error text after interaction or a failed submission. Optional and disabled fields remain exempt. A supplied SIRET is normalized and checked for 14 digits, the SIREN and SIRET checksums, and the La Poste exception, following [INSEE FrLab validation rules](https://github.com/InseeFrLab/validinsee#validité-de-numéros-siren-ou-siret). This is a local input check; no registry lookup or automatic approval occurs. The donation address is optional. Submission creates a pending registration; the platform persona reviews it at `/admin`. Categories, capacity and appointment slots are configured after activation. This flow follows `AssociationCreate`; it does not use the mockup's provisional Categories step.

Nearby needs starts with an empty Location field and a pin icon. Searching displays the demo limitation; it does not geocode the entered address or replace the illustrative Paris listings.

Platform approvals use one selected association for the row highlight, detail panel and approval action. Clearing selection or changing the status filter removes the approval target. Visitors can choose the donor demo persona on the registration Review step without leaving the page or losing their entries. Company drafts reject a product description containing only spaces before opening the photo step. Shared fields preserve explicit accessible names supplied by their callers.

Local demo controls reset browser data. Reset once to see the expanded fixtures if this browser already contains an older demo. State uses localStorage key `dono-demo-v1`. If saving fails, the demo keeps current changes in memory and shows a browser storage warning with Retry saving. A later successful write or retry saves the latest complete session without repeating its actions. If earlier browser data cannot be read, ordinary actions leave that copy untouched. The warning explains that explicitly retrying replaces it with the current session. Registration and offer confirmations identify session-only changes. Photos selected from disk are temporary previews and are not uploaded or stored there.

## Boundaries

- Personas are simulations, not authentication or access controls. Never enter private data into this demo.
- Analyses use fixed fictional indicators. They do not inspect uploaded images or call a model.
- Matching checks local needs and capacity. Distance is an explicitly labelled example; location text does not call a geocoder.
- The QR contains an unsigned local reference. Reception lookup simulates the flow; it does not verify a signature or use a camera.
- Source dates and read-time day counts are visible. FEFO controls are removed at the user's request. Expiry buckets and unresolved intake policies are not invented.
- Public needs are separate illustrative listings. Public claiming, messaging, transport, disposal, cancellation and unsupported API actions are unavailable.
- The demo has one donor and one active association. Browser state is not a database transaction, durable idempotency ledger or multi-user authorization system.
- DM Sans loads from Google Fonts at runtime, with a system fallback. Builds do not download fonts.

## Verification

Prettier uses the pinned local version and its default formatting rules. Run
`pnpm format` to format frontend source, configuration and Markdown. Run
`pnpm format:check` to check formatting without changing files. Generated files,
the lockfile and public assets are excluded by `.prettierignore`.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Formatting, lint, typecheck and 134 tests pass. Tests cover fixed-description drafts, warning history, company facts, independent evidence, pending registration with separate legal references and optional address, human decisions, revisions, capacity/slot conflicts, reduced reception, distribution, Paris time conversion, calendar navigation, booking availability, table sorting/search/single selection, cross-date demo-reference lookup, fixed need-draft provenance with altered-quantity rejection, multi-photo validation/races and reception-refusal evidence, terminal guards and released occupancy. Additional cases cover capacity thresholds and paused limits, required-field feedback and disabled controls, stable accessible labels, SIRET validation and the registration guard. Posted-offer cases cover ownership, revisions, warnings, no-match eligibility, edit locks, safe date/PAO projection, withdrawal and legacy-state normalization.

The review fixes add mocked component-flow checks for controlled approval selection, registration continuity and trimmed company products. Static rendering checks cover explicit field names and storage feedback. Substitute Storage checks cover quota/security failures, protected unread snapshots and saving the latest session after recovery. These checks do not verify browser focus, native keyboard behavior or actual browser storage failures. Fresh browser checks could not run: the Playwright connection was closed, and preview restart had failed with `listen EPERM`.

The final production build passed for 20 routes in `/private/tmp/dono-review-fixes-final-2vber7qj`, with all 84 source/asset files byte-identical and the same installed dependencies. The sandbox prevented replacing earlier generated `.next` files and denied local listening ports. The build used `CI=1 __NEXT_AGENT_UPGRADE=security NEXT_TELEMETRY_DISABLED=1` to avoid Next's automatic registry check in this restricted environment. Tests used a fresh temporary `--fsModuleCachePath` with `--no-cache` because the existing generated cache was not writable.

Earlier browser evidence used compiled HTML, JavaScript and CSS served through browser request interception, without a listening server:

- All 17 static routes rendered at 1440px and 375px. No document overflow or uncaught page errors appeared in that sweep. An independent reviewer inspected all 34 captures against the selected references.
- Actual UI interactions covered draft creation, sample analysis, the named correction dialog, quantity correction, matching, offering, staff approval and cross-date reception lookup. Unsupported free text created no drafts; the fixed description created two.
- A separate temporary preview prerendered three fixture IDs around the unchanged booking client component. It verified time selection, saved-booking recovery after simulated QR failure, QR rendering, reception of 2 out of 6 units and distribution of 1 unit, leaving 1. This verifies the component with fixtures, not production dynamic routing.
- Mobile Home, dashboard overflow and shared button/chip styling were corrected and re-rendered. The browser connection closed before the warning-state checks; those checks remain source-only. The final donor date-label and probabilistic-warning wording fixes were source-reviewed and rebuilt after the connection closed. Native progress colors were subsequently verified in the live capacity checks below.

The current changes were also checked in Chrome against the existing live Next.js development server. Checks covered table search, sorting and row selection; desktop/mobile navigation; calendar keyboard controls and Today; hidden full slots; clearing a selected time when the date changes; and the real dynamic booking route, including saved-booking QR failure and retry. Registration and photograph progress share the same component and were checked at desktop/mobile widths. Test bookings used a separate browser origin to preserve the user's existing demo data.

The latest correction checks covered pointer/keyboard row selection without checkboxes, independent detail actions, equal search/table widths on desktop and mobile, registration validation and Back/Next preservation, skipping the address, SIRET-only submission and correct pending-record details in the platform view. Nearby Location placeholder, category filtering and responsive spacing were also checked. A fresh page load after source edits produced no browser errors; a prior hot-reload mismatch during edits did not recur.

Further live checks verified one selected row after selecting two different rows, expanded evidence fitting at desktop/tablet/mobile widths, login-to-signup-to-donor navigation, aligned empty/sample upload cards, exact dialog centering and scrolling at a short mobile height. Escape/Close restored original corrections and focus; Save preserved edited facts. Disk-file selection/replacement and invalid-file rejection could not be exercised through the browser: the extension required file-URL access and native picker control was denied. Existing validation remains source-reviewed; no browser permission was changed.

The navigation and Needs update passed independent source review and live Chrome checks. The 72 px collapsed rail retains nine labelled icons; resizing from collapsed desktop to 375 px restores the full mobile menu without document overflow. Receipt details preserve quantity across hide/show, reject zero and excessive quantities, record a reduced receipt once and reopen its history. Lookup opens the matching Paris date and focuses details. Navigation counts update after receipt and need changes. Needs selection loads the editor by pointer or keyboard, remains singular through filtering, and clears on save or deselection. Pausing a selected need preserves unsaved fields and remains paused after saving. Unsupported text creates no draft; the fixed sample requires confirmation, supports field edits and discards without publishing. Stale draft feedback clears after form actions. A fresh load produced no browser warnings or errors.

The multi-photo and refusal update passed independent source review and live Chrome checks. At 375, 768 and 1280 px, the stepper and upload area have equal widths with no document overflow. Sample batches, main-photo selection, removal, the six-photo cap, empty-photo guard and review/back preservation passed. Thumbnail action rows align. Refusal requires a reason and confirmation, works independently of an invalid receipt quantity, survives reload, retains appointment history, releases slot occupancy and leaves stock unchanged. Received items expose no refusal action. Donor details and direct booking show the reason and no active QR. Duplicate category filters and FEFO panels are absent; normal distribution remains. Actual disk-file selection remains unverified under the picker restriction above.

The table, capacity and form update passed independent source review and live Chrome checks at desktop and 375 px. Selected rows show the stronger green background, with aligned checks and independent detail actions. Capacity bars rendered green, orange and red with percentages; a zero limit showed Paused. Temporary test limits were restored. Empty required fields show linked red feedback, while a blank field disabled by its fieldset did not block saving a need. Registration rejected an invalid SIRET even with an RNA, accepted a formatted valid SIRET and RNA-only input, preserved fields when going Back, cleared the skipped address and saved a pending demo registration. External footer buttons submit through Enter and fit mobile labels; donor Back preserves sample photos. Location errors leave space above category controls. Fresh browser logs had no warnings or errors. The final build used `/private/tmp/dono-forms-capacity-final-dnorl5xs`.

Unmatched posting passed independent source review and live Chrome checks at desktop and 375 px. An unmatched clothing draft posted once, retained its confirmation after reload and appeared in the donor's Posted filter and the association gallery. Search, category filtering, keyboard selection and mobile widths passed. A food post retained a corrected date and displayed `DDM, 1 Feb 2027`. Withdrawal restored editable product and date fields. Review and stock counts stayed unchanged. The final 115-test suite and 20-route build passed, with byte-identical source in `/private/tmp/dono-posted-offers-final-o3ry_ntf`. The preview server stopped before the last gallery reload after withdrawal. Restart attempts failed with `listen EPERM`. Above-fold image loading was corrected after a Next.js development warning, but its fresh-browser recheck could not run. Listing removal is covered by the executed store tests.

Actual microphone capture, permission denial and browser speech-service responses were not exercised. Their lifecycle and error handling were source-reviewed. The typed and fixed-sample UI paths were verified; these checks do not prove live speech recognition or AI parsing.

Real API/auth/database/provider behavior, camera scanning, signed QR verification and complete target-device accessibility were not tested. No backend was implemented.
