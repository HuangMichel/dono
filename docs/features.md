# Dono features and use cases

Status: proposed delivery specification for a ≤40-hour hackathon MVP. The [requirements](requirements.md) define authority, actors, permissions, business rules and unresolved decisions. AGENTS.md overrides this document if any conflict is found.

`FEAT` identifies a feature, `UC` a use case, and `UC-…-AC…` a uniquely identified acceptance criterion. M is required MVP; S1–S4 are optional work removed in that order; P is post-MVP. Criteria describe future observable behavior, not completed tests. The [domain model](domain-model.md) supplies working defaults DEC-001–DEC-012 for the six review findings. Only the remaining open AMBs are conditional; these criteria are future tests, not passing implementation evidence.

## Feature catalog

The frontend now uses the real API and removes runtime demo records. The [current integration notes](requirements.md#connected-frontend--2026-10-25) distinguish connected behavior from unsupported product designs. Explicit donor posting and authenticated association browsing are restored; see the current posting rules in requirements.md. Claiming and reception refusal remain unavailable.

| ID | Feature | Priority | Minimum deliverable / boundary |
|---|---|---|---|
| FEAT-001 | Identity, roles and association approval | M | Donor/staff isolation and platform approval of RNA/SIRET association registrations. No general platform access to donation decisions. |
| FEAT-024 | Public needs directory | M | Browse needs without an account; sign up or sign in when choosing to offer an item, preserving the selected need. |
| FEAT-002 | Needs capture | M | Structured form plus editable free-text parsing draft. Staff confirm the final need. |
| FEAT-003 | Capacity, hours and slots | M | Separate item demand, storage places, dated intake quotas and appointment places; configure all four explicitly. |
| FEAT-004 | Donation photo capture | M | Mobile-browser capture/upload, food/para label close-up and server validation before provider calls. |
| FEAT-005 | Category-specific analysis | M | OpenAI structured extraction, condition/risk indicators and confidence for all five categories. No AI decisions. |
| FEAT-006 | Editable facts and category, preserved evidence | M | Human facts and source dates distinct from originals; safe late-result attachment, manual fallback and frozen offer evidence scopes. |
| FEAT-007 | Deterministic matching | M | Independent need/storage/intake/slot checks plus season and Haversine ordering; no model or reservation in matching. |
| FEAT-008 | Warnings and other options | M | Medicine/pharmacy and chilled/frozen-food warnings; textile/repair/pharmacy redirect list without communications. |
| FEAT-009 | Offers and My donations | M | Reusable donor item with distinct historical attempts; send one active offer and follow separate human decision/booking/stock outcomes. |
| FEAT-010 | Association review queue | M | Photos, evidence/corrections, expiry and explicit staff approve/refuse action. |
| FEAT-011 | Expiry and distribute-first list | M | Read-time days/buckets, unknown-date visibility and FEFO for received undistributed stock. |
| FEAT-012 | Drop-off booking and donor QR | M | Book only an approved offer into a slot with space; retrieve appointment/QR in-app. |
| FEAT-013 | Today's arrivals and QR reception | M | Association-scoped appointments, authenticated validation and explicit reception without duplicate effects. |
| FEAT-014 | Light inventory and distribution | M | Full receipt/distribution movements; distribution releases storage, never fulfilled demand or consumed intake quota. |
| FEAT-015 | Basic image and expiry dashboard | M | Photo gallery, indicator overlays, basic filters, expiry counts and link to the distribute-first list. |
| FEAT-016 | Jev / hybrid providers | S1 | Optional probabilities behind provider selection; OpenAI handles extraction. No unresolved Jev-only behavior in the baseline. |
| FEAT-017 | Provider comparison | S2 | Attributable OpenAI/Jev indicator comparison; no automatic quality verdict. Depends on FEAT-016. |
| FEAT-018 | Expiry timeline | S3 | Chart of code-computed date information under the same resolved bucket/date policy. |
| FEAT-019 | AI/human agreement metric | S4 | Reporting only with an agreed annotation and denominator definition. |
| FEAT-020 | Advanced metrics, impact and discovery | P | Average shelf life, impact dashboard, automatic registration verification, visual map and partnerships. The reviewed README follows this proposed deferral; AMB-020 still records the product scope decision. |
| FEAT-021 | External channels and logistics | P | Future scope candidates only: notifications/email, messaging, association transfers, pickups and routing. No MVP integrations, screens or background jobs. |
| FEAT-022 | Attempt deadlines and recovery | M | Finite review/approval/booking windows, deadline-aware availability, cancellation/no-show release and re-offering with history. |
| FEAT-023 | Association membership lifecycle | M | Atomic applicant-admin activation, audited grants/revocation/transfer, last-admin protection and constrained orphan recovery. |

## Lifecycle and evidence boundaries

The [domain model](domain-model.md) is the normative transition/accounting profile. A donation owns current human facts; an offer owns its frozen target, evidence scope and human decision. Refusal closes an attempt and leaves the item reusable. An active attempt freezes item edits; withdraw first to correct/re-offer. Previously registered AI calls may finish without changing the snapshot or human values.

| Aggregate | States / transitions | Guard / effect |
|---|---|---|
| Donation | draft → ready; ready ↔ withdrawn; ready → transferred | Publish/restore requires valid facts/photos; whole-item withdrawal closes live offer/booking. Receipt alone marks the item transferred out of donor availability. |
| Offer | pending_review → approved/refused/withdrawn/expired; approved → fulfilled/withdrawn/cancelled/expired | One active attempt per item. Only target personnel approve/refuse. Re-offering creates a new row, not a reset. |
| Booking | booked → received/cancelled/no_show | One booking per attempt, many historical bookings per item; cancellation closes the offer and releases all unreceived holds. |
| Inventory | unreceived → in_stock → distributed | Read-time projection of actual full-lot movements. One receipt and distribution across all item attempts. |

Review expires after 72 hours, unbooked approval after 24 hours. A booking starts within seven days; reception is valid from slot start until slot end + 30 minutes, excluding the cutoff. Deadline-aware reads release availability even without a scheduler. Preserve effective/recorded event times and original human decisions after expiry/cancellation. No partial receipt/distribution or in-place rescheduling in MVP.

## Detailed MVP use cases

### UC-017 — Browse needs and start an offer

**Actor:** public visitor or signed-in donor. **Feature:** FEAT-024. **Trigger:** open Nearby needs.

**Flow:** load public needs; optionally search by town or postcode and filter by category; inspect a need; choose Offer an item. A visitor creates an account or signs in before preparing a donation. Authentication preserves the selection. The existing matching and offer flow validates the actual item against current availability.

- **UC-017-AC01:** A visitor without a session can load needs, inspect criteria and association drop-off details, filter and paginate. No authentication request is required for the listing.
- **UC-017-AC02:** Only approved associations' active, in-season needs with positive remaining demand appear. The response excludes staff identities, free-text source notes, private budgets, donations and photos.
- **UC-017-AC03:** Empty or whitespace-only location lists eligible needs without distances. A town search includes only associations with the BAN-resolved town name; a full five-digit postcode search includes only that postcode. Combine location with category filtering before pagination, then order matches by computed straight-line distance. For example, searching `Mulhouse` or `68100` excludes Paris associations. Changing the search or category resets the page and selected need. Geocoding failure shows an error with retry; an empty list stays empty.
- **UC-017-AC04:** Offer an item leads a visitor to signup, with a sign-in alternative. Successful authentication and profile bootstrap return to donation preparation with the selected need, category and location. Email confirmation preserves the same continuation when configured.
- **UC-017-AC05:** A changed or unavailable need cannot bypass matching or send an offer automatically. Unauthenticated donation writes, private reads and evidence access remain rejected. Return URLs cannot navigate to an external site.

### UC-001 — Authenticate and enable an association

**Actors:** donor, association applicant, platform admin. **Features:** FEAT-001. **Trigger:** a person signs in or submits an association registration.

**Preconditions:** Supabase email/password authentication configured; an authenticated session exists, after email confirmation if required; profile bootstrapped as donor only (DEC-008).

**Main flow:** verify identity; provision the caller's donor profile; register a pending association with the applicant's inactive admin membership and bootstrap event; platform manually verifies RNA/SIRET; approve and activate that same applicant atomically.

**Alternatives:** unauthenticated requests cannot read protected records; a pending registration remains outside new matched offers; duplicate normalized identifiers fail; a pending applicant can correct registration fields; rejection/resubmission UI is deferred. Membership administration follows UC-016.

**Postcondition:** the user has only the permissions of their role and membership, and association approval is separate from donation decisions.

Acceptance criteria:

- **UC-001-AC01:** Given donors A and B, when A requests B's donation, analysis, photo, booking or QR by direct identifier, access is denied without disclosure.
- **UC-001-AC02:** Given personnel for associations X and Y, X cannot read or mutate Y's offers, needs, capacity, slots, stock or photos through UI or direct API/data requests.
- **UC-001-AC03:** Given a pending association, it is absent from new matching results until a platform admin manually approves its registration.
- **UC-001-AC04:** A donor cannot self-assign a privileged role through editable account metadata; association approval grants no platform permission to decide donations.
- **UC-001-AC05:** Email/password signup and sign-in replace Google. When signup returns no session, show a confirmation prompt and do not bootstrap a profile or allow protected operations. When a session exists, provision donor capability only. Association approval activates only the original applicant admin once, and a failure rolls back both registration approval and activation.
- **UC-001-AC06:** Signup accepts passwords of at least eight characters. Credentials go directly to Supabase Auth. Invalid credentials and provider failures show a recoverable error; submission cannot create duplicate in-flight requests. Profile or membership failures keep protected content unavailable while allowing retry and sign-out.

### UC-002 — Configure needs, capacity and drop-off availability

**Actors:** association admin; association staff only where authorized. **Features:** FEAT-002, FEAT-003. **Trigger:** the association updates what it needs or can receive.

**Preconditions:** active admin of an approved association; DEC-004/009/012 apply.

**Main flow:** enter a need in the form or paste free text; review a parsed draft if used; confirm structured values; set category storage places, per-item storage rate and dated category intake quotas; configure hours and drop-off slots; save and expose the current configuration to matching and booking.

**Alternatives:** a parsing failure returns to the form without inventing quantities; invalid values cannot become active configuration; booked times/address/hours cannot be edited until affected bookings are cancelled; timezone freezes after any slot exists.

**Postcondition:** confirmed association configuration is current and scoped to the association; reservations and stock stay distinct from configured limits.

Acceptance criteria:

- **UC-002-AC01:** Given free text with a stated item quantity, parsing preserves the stated quantity for staff review; no need becomes active before confirmation and no derived quantity is calculated by AI.
- **UC-002-AC02:** If parsing fails or an attribute is missing, staff can complete the same need through the form; the system does not fabricate season or quantity.
- **UC-002-AC03:** A change to confirmed needs, season or capacity affects subsequent matching reads using the same agreed units.
- **UC-002-AC04:** Given capacity is full under the agreed reservation policy, the association is ineligible for additional matching in that category and competing operations cannot overcommit it.
- **UC-002-AC05:** Only its active admins configure needs/storage/quotas/slots; each ceiling is independent, reducing below commitments fails, and slots cannot overlap or cross the local date/hours.

### UC-003 — Capture an item and validate its photos

**Actor:** donor. **Feature:** FEAT-004. **Trigger:** the donor starts a scan.

**Preconditions:** signed-in donor; configured upload formats/limits and photo-count rule (AMB-003).

**Main flow:** capture or select item photos; include a label close-up for food/para; submit files; validate type and size on the server; encode validated bytes to canonical base64 and atomically persist private.photo_contents plus metadata/digests in donation_photos. Retain photo IDs for analysis; no Supabase Storage.

**Alternatives:** unsupported/oversized files show an actionable error before any provider call; an unreadable label remains unknown and can be corrected with better evidence. Camera/file selection behavior follows the supported browser decision.

**Postcondition:** valid photos belong to the donor's item and are available only to authorized readers.

Acceptance criteria:

- **UC-003-AC01:** Configured decoded-byte and encoded-base64 limits are enforced on the server even if a client-side control is bypassed; rejected files are not sent to a model.
- **UC-003-AC02:** The food/para capture flow requests a readable date/product label close-up and follows the photo cap agreed in AMB-003.
- **UC-003-AC03:** Another donor or unrelated association cannot obtain the photo through a guessed photo/donation identifier or a direct query of the private payload table.
- **UC-003-AC04:** A failed upload shows failure and allows correction/retry without presenting an analysis result or successful offer. Metadata/content commit together or both roll back; retries cannot duplicate photos.
- **UC-003-AC05:** Photo list/evidence DTOs contain no base64 payload; authenticated content reads decode the retained original bytes and check their digest, without accessing a bucket.
- **UC-003-AC06:** The donor can open a live camera preview for an item or label, capture a photo, retake it and confirm it. Only confirmation changes the local photo selection; capture alone starts no upload or analysis. The same size and total-count limits apply to captured and selected files.
- **UC-003-AC07:** Closing the camera, leaving the screen or reviewing a capture releases every camera track. A late permission response cannot reopen a closed camera or add a photo. Camera errors provide a file-selection fallback. Keyboard users can reach every control, close with Escape and return focus to the opener.
- **UC-003-AC08:** Before photos, the donor enters an item name and an optional description. A blank name prevents continuing in the form. Names are trimmed and limited to 120 characters; descriptions are trimmed and limited to 2,000 characters. An empty description becomes null. The API permits incomplete drafts but requires a name before publication, restoration, posting or a new recipient offer.
- **UC-003-AC09:** Photo analysis and category changes preserve the donor's name and description. Saving and reopening restores them. A text-only draft remains eligible for initial analysis seeding of structured category facts.

### UC-004 — Read category-specific analysis and safety indicators

**Actors:** donor; analysis service. **Features:** FEAT-005, FEAT-008. **Trigger:** validated item photos are analyzed.

**Preconditions:** OpenAI configured server-side; the five analysis-v1 contracts and null/threshold rules apply.

**Main flow:** call the category-specific extraction/indicator provider; validate its result; preserve the original result and provenance; show extracted facts, indicators and confidence; display applicable medicine/cold-food warnings and other options.

**Alternatives:** failed/schema-invalid analysis shows an error and permits retry without fabricated results; low-confidence or unknown facts stay visibly uncertain. Medium/high bands, explicit human clarification and manual fallback follow analysis-v1; no probability sets decision. Confirmed medicines remain outside donation scope.

**Postcondition:** usable evidence is available to the donor and later to authorized association reviewers; no donation decision has been made.

Acceptance criteria:

- **UC-004-AC01:** Successful output conforms to `AnalysisResult` in AGENTS.md and preserves provider, model, one of the five categories, extracted facts, indicators and confidence.
- **UC-004-AC02:** Clothes support type/size/season and wear/stains/holes/pilling; shoes support size/pair/sole/upper evidence; food supports product/date/type and packaging; para supports seal/expiry/PAO/medicine concern; furniture supports type/size class/damage. Missing evidence remains unknown.
- **UC-004-AC03:** Indicator copy such as “Stains likely — 61%” is distinguishable from human decision status. No analysis card/button/response says the AI accepted or refused an item, and no analysis call sets `decision`.
- **UC-004-AC04:** A high medicine indicator visibly warns and points to a pharmacy. Changing the working category cannot erase the original warning or create an exception allowing a confirmed medicine donation.
- **UC-004-AC05:** Chilled/frozen-food concern produces a visible warning, and confirmed chilled/frozen individual food is not presented as eligible room-temperature non-perishable food. Submission remains a human-review attempt; medium/high concern requires explicit clarification/reason before approval.
- **UC-004-AC06:** Schema-invalid output, provider refusal or failure creates no fabricated confidence, date or donation decision. The required 25–35-photo evaluation includes medicines and para, with expected indicator behavior recorded rather than an AI acceptance verdict.

- **UC-004-AC07:** Each of five branches rejects unsupported keys/enums and validates all common/category indicator keys; null remains unknown and category probabilities/confidence are preserved without renormalization.
- **UC-004-AC08:** At p=0.50 and p=0.80 Python assigns medium/high; missing probability never becomes low. Category confidence below 0.80 or valid evidence conflict prevents automatic seeding but permits complete human facts.
- **UC-004-AC09:** A donor category override and a delayed/disagreeing run preserve original category/indicators/source; staff see mismatch and required manual-review acknowledgement. AN-T001–016 cover the exact contracts.

### UC-005 — Correct category or facts without changing AI evidence

**Actor:** donor; authorized reviewer reads corrections. **Feature:** FEAT-006. **Trigger:** the donor spots an incorrect size, category, date or other extracted fact.

**Preconditions:** own draft/ready/withdrawn item with no active offer; no successful AI result is required. Human facts may be entered before analysis completes.

**Main flow:** inspect original and working values; edit working category/facts; validate the correction; retain its human attribution separately; recompute derived expiry/matches from current valid facts; show both versions to reviewers. A new analysis is optional while editable; retain old provenance and mismatch labels.

**Alternatives:** invalid date/field input shows an error and does not replace valid working facts; incompatible old category-specific indicators remain labeled with their original category; failed reanalysis cannot overwrite earlier output.

**Postcondition:** working facts reflect the correction while original extracted values, indicators and confidence remain intact.

Acceptance criteria:

- **UC-005-AC01:** Given an original `clothes` category and an allowed correction to `shoes`, the working category changes while the original category/result/indicators remain unchanged and identifiable.
- **UC-005-AC02:** Given an incorrectly extracted date or size, the donor can correct the working fact; later matching/expiry reads use the validated correction and the review screen shows the difference.
- **UC-005-AC03:** Requests to edit original probability, indicator level, confidence, model or provider are rejected, including direct requests that bypass the UI.
- **UC-005-AC04:** If reanalysis occurs, both results remain attributable; a new run does not replace or relabel old category-specific indicators. A late result attaches a missing comparison basis separately, but seeds only an empty unchanged working set with no active offer.
- **UC-005-AC05:** Editing category or facts cannot directly set a staff decision, erase an original warning or silently change an already-reviewed offer; active-offer edits/new analysis requests are rejected until withdrawal. A captured in-flight result may append scoped evidence, without modifying snapshots or decisions.
- **UC-005-AC06:** Name and description corrections follow the same revision and active-offer guards as other item facts. A recipient sees the name and description frozen in its offer. Later donor changes do not alter that recipient's review, reception or stock display. Existing snapshots without these fields retain product/type/category fallback labels.

### UC-006 — Match a donation or view other options

**Actors:** donor; deterministic matching/geocoding services. **Features:** FEAT-007, FEAT-008. **Trigger:** the donor asks where to offer the item.

**Preconditions:** valid human or AI-seeded facts/location; approved associations; DEC-004/009 matching profile. Origin is request-scoped, not stored.

**Main flow:** geocode the necessary address; read independent remaining need demand, storage, dated quota and appointment places plus season; compute eligibility and Haversine distance; show deterministic results/reasons in the agreed distance order; let the donor select a target or read other options.

**Alternatives:** no eligible association shows an explicit empty result and redirect points; unavailable location/geocoding does not yield invented distances; warnings and confirmed-item exclusions still apply. A selected target whose capacity changes is revalidated when offering.

**Postcondition:** the donor has a suitable target or a clear no-match/other-options result; no staff decision has been inferred.

Acceptance criteria:

- **UC-006-AC01:** Repeating matching with identical facts, association configuration and coordinates returns the same results and order; the matching path makes no model call.
- **UC-006-AC02:** Insufficient demand, storage, daily intake or slot places and incompatible season each exclude a candidate independently. With demand 10, storage 6, rate 2 and intake 2, a lot of 3 fails intake despite fitting storage.
- **UC-006-AC03:** For otherwise equivalent eligible associations with different coordinates, code-computed Haversine distances determine the agreed distance order. Ties use association ID then need ID; no radius cutoff or route metric is used.
- **UC-006-AC04:** Failed geocoding or unknown coordinates are shown explicitly; the system does not invent a “nearby” result, route or travel time.
- **UC-006-AC05:** Zero results offers other-options information, including pharmacy redirection for medicine concern. It does not offer a pickup, send a message or create an external reservation.
- **UC-006-AC06:** The donor receives only the agreed association listing fields; matching does not grant access to raw private needs/capacity/membership records.

### UC-007 — Submit an offer and follow its status

**Actor:** donor. **Feature:** FEAT-009. **Trigger:** the donor selects a matched association and offers the item.

**Preconditions:** own ready item, complete facts and valid photos; no effective active offer; approved target. Pending/unavailable AI is explicitly allowed.

**Main flow:** revalidate current target eligibility/capacity; submit the offer; make it visible in the target queue; freeze source facts and allowed photo/request/edit IDs in a new pending_review offer with 72-hour deadline; reflect later staff, booking and inventory events in-app.

**Alternatives:** a stale/ineligible target produces a conflict and refreshed matching rather than successful submission; retries do not create unintended duplicates; due attempts are materialized before the partial unique-index check; a refusal permits a new attempt on the same donation ID.

**Postcondition:** the donor owns a traceable offer to the target association; it is not approved merely because submission succeeded.

Acceptance criteria:

- **UC-007-AC01:** A submitted offer appears in its owner's My donations and only the addressed association's review queue; it initially has no AI-made approval/refusal.
- **UC-007-AC02:** If target approval, need or capacity eligibility changes before commit, submission is revalidated and does not report a stale success.
- **UC-007-AC03:** Human approved/refused, booked, received and distributed states become visible in-app to the donor, with refusal as a branch that cannot be booked.
- **UC-007-AC04:** Concurrent submissions to different associations allow only one active attempt. After refusal, a new attempt retains the same donation ID and original offer history; retries do not duplicate events or notify externally.

### UC-008 — Review an offer and record a human decision

**Actor:** authorized target-association admin/staff. **Feature:** FEAT-010. **Trigger:** personnel open the review queue.

**Preconditions:** live pending offer addressed to an approved association; current enabled admin/staff membership. Analysis-v1 and expiry-v1 supply the uncertainty and date guards.

**Main flow:** inspect photos; compare original indicators/category/facts with working corrections; read confidence and code-computed expiry/warnings; check current need demand/storage and existence of usable quota/slot; assert not-medicine/eligible food and acknowledge manual review if evidence is unavailable; explicitly approve or refuse; persist the reviewer attribution and display the human decision.

**Alternatives:** a competing decision or changed capacity produces a conflict; an unknown date remains unknown; confirmed medicines cannot be approved as an exception. Approved/refused decisions are write-once; cancellation is a separate action, preserving the earlier approval. Shelf-life treatment follows expiry-v1, with strict-date clarification and DDM acknowledgement.

**Postcondition:** the offer has an authorized human decision; immutable AI evidence is unchanged.

Acceptance criteria:

- **UC-008-AC01:** The reviewer sees photos, original indicators/confidence, corrections, current category, applicable warnings and read-time expiry information before deciding.
- **UC-008-AC02:** Only authorized target-association personnel can set `decision`; donor/provider/unrelated-association requests are denied.
- **UC-008-AC03:** A successful decision records the human actor. Its UI label identifies association approval/refusal separately from AI estimates.
- **UC-008-AC04:** Concurrent approvals lock common budgets; only fitting lots acquire demand/storage holds. Approval has a 24-hour booking deadline, no daily quota reservation yet, and cannot silently overwrite another decision.
- **UC-008-AC05:** Approving/refusing changes neither original indicators nor their probabilities. A confirmed medicine cannot proceed through an approval override; strict-date and DDM handling follows expiry-v1; required date acknowledgements/reason never become an AI verdict.

### UC-009 — Inspect photos, expiry buckets and distribute-first stock

**Actor:** association personnel. **Features:** FEAT-011, FEAT-015. **Trigger:** staff inspect the image/expiry dashboard or decide which stock to distribute first.

**Preconditions:** received undistributed stock in the association; use that offer's frozen source dates/evidence. Expiry-v1 defines bucket/PAO/FEFO interpretation; operational reference is association-local.

**Main flow:** open the gallery; filter category/indicator/expiry; inspect original vs corrected facts; calculate days/expired/buckets from source facts at read time; inspect expired/unknown counts; view received undistributed items in FEFO order.

**Alternatives:** unreadable/ambiguous dates are explicit; PAO without usable opening information cannot produce an invented expiry; offered/refused/unreceived items do not appear as received stock in distribute-first.

**Postcondition:** staff can prioritize actual stock using current calculations; no derived expiry values have been persisted.

Acceptance criteria:

- **UC-009-AC01:** An item with a valid source date changes its days-left/bucket display as the reference date changes, without updating a stored derived value or invoking a model for arithmetic.
- **UC-009-AC02:** Today, yesterday/expired, unreadable date and values at 7, 30 and 90 days have explicit expected outcomes under expiry-v1. Today is bucket today with expired=false; exactly 7/30/90 map to lt_30/lt_90/at_90, preserving the literal >90 tail.
- **UC-009-AC03:** Missing/unreadable dates remain visible as unknown, never zero days or an invented long shelf life; date type DLC/DDM/expiry/PAO remains visible where known.
- **UC-009-AC04:** For usable dates on received undistributed stock, earlier expiry precedes later expiry in distribute-first. Unknown and unopened PAO-only use explicit unknown/not-applicable FIFO groups under expiry-v1, and fully distributed items leave the list.
- **UC-009-AC05:** Gallery overlays show original indicators as estimates and corrections separately; gallery/counts/distribute-first use received undistributed lots only; historical refused attempts do not inflate stock, and staff never read later raw donor corrections.

- **UC-009-AC06:** DDM month/year resolves to its calendar end only in Python at read time; incomplete DLC/ambiguous date stays unknown. PAO requires confirmed opening state and human opened_on; unopened PAO-only never starts at upload time.
- **UC-009-AC07:** At one reference instant each lot has exactly one of nine buckets and a total FEFO tie order. Unknown, unreadable and not-applicable counts remain distinct; blocked strict-date stock is visible separately from recommendations.
- **UC-009-AC08:** Current approval/slot/reception/distribution date guards use expiry-v1 and a fenced Python date context; midnight/source/evidence races require recomputation. EX-T001–033 are the future acceptance fixtures; no computed expiry/rank is stored.

### UC-010 — Book an approved drop-off and retrieve its QR

**Actor:** donor. **Feature:** FEAT-012. **Trigger:** the donor books a staff-approved offer.

**Preconditions:** own live approved offer before its 24-hour cutoff; future eligible slot within seven days; sufficient dated intake quota and appointment places.

**Main flow:** choose an available slot; recheck offer/deadline, daily quota and appointment place under parent locks; replace the unbooked cutoff with slot end + 30 minutes; commit booking consistently; generate the booking QR; display association drop-off location, appointment time and QR in My donations.

**Alternatives:** a taken slot offers refreshed availability; unapproved/refused/foreign offers cannot be booked; cancellation closes that offer and releases demand/storage/quota/place; rescheduling requires a fresh attempt and review. No transport is arranged.

**Postcondition:** a confirmed booking occupies the agreed slot allocation and its QR is retrievable by its donor.

Acceptance criteria:

- **UC-010-AC01:** Offered or refused items cannot be booked; the donor can book only their own approved offer at its target association.
- **UC-010-AC02:** Competing last-slot or last-daily-quota requests cannot overbook either budget; a slot place does not imply enough intake quantity. At deadline equality booking fails and releases the expired hold.
- **UC-010-AC03:** After a confirmed booking, the owner can reload appointment and QR in-app; confirmation does not depend on email or messaging.
- **UC-010-AC04:** The appointment identifies donor drop-off at the association, without pickup, carrier selection, routing or delivery tracking.

### UC-011 — Receive a booked donation using QR

**Actors:** association personnel; donor presents the QR. **Feature:** FEAT-013. **Trigger:** the donor arrives with the item.

**Preconditions:** enabled target admin/staff, live booked appointment and signed QR; database clock in [slot start, slot end + 30 minutes).

**Main flow:** read today's arrivals; scan the QR; resolve and validate the booking server-side; inspect the linked item/offer; explicitly confirm actual reception; update received state and stock consistently; reflect the event in the donor's status.

**Alternatives:** malformed/foreign/already-received QR shows the appropriate failure/current state without adding stock; camera failure permits typing the same signed payload. Early/late and partial receipt fail; staff may cancel an unreceived mismatch with a reason and require a fresh offer.

**Postcondition:** physical reception is recorded once with staff attribution and the agreed capacity/need effects. A QR scan alone does not approve an offer.

Acceptance criteria:

- **UC-011-AC01:** Today's list is scoped to the association and the agreed date/timezone, with booking/item and reception state available.
- **UC-011-AC02:** A QR from association X cannot be received by Y's personnel; an unauthenticated QR request grants no reception permission or private booking details.
- **UC-011-AC03:** A valid scan resolves the intended booking for staff confirmation; receipt commits once and the owner sees received status in-app.
- **UC-011-AC04:** Repeated/concurrent reception commits one full receipt per donation across all attempts; booking becomes received, offer fulfilled and item transferred atomically. Holds become fulfilled demand/consumed quota/stock without double counting.
- **UC-011-AC05:** Invalid QR/state shows failure/current state and changes no stock; QR validation cannot change original AI indicators or set a new donation approval.

### UC-012 — Record distribution and maintain light stock

**Actor:** authorized association personnel. **Feature:** FEAT-014. **Trigger:** received items are distributed.

**Preconditions:** actual full receipt owned by the target association; no prior distribution of that donation.

**Main flow:** inspect stock, including distribute-first guidance; select its immutable receipt ID and confirm full-lot distribution; record actual distribution; update remaining stock and relevant capacity/need state in code; show distributed status when its agreed completion condition is met.

**Alternatives:** offered/booked/unreceived items cannot be distributed from stock; excessive/duplicate distribution is rejected or returns the existing result; correction/reversal rules require an explicit later decision.

**Postcondition:** remaining inventory reflects actual recorded movements and cannot be negative; donor status reflects the agreed lifecycle.

Acceptance criteria:

- **UC-012-AC01:** Only received stock in the member's association can be distributed; donations still offered, refused or booked do not count as received inventory.
- **UC-012-AC02:** Reception adds and distribution removes the agreed quantity once; repeated or competing distribution cannot exceed the remaining quantity.
- **UC-012-AC03:** Distribution releases only physical storage; fulfilled need demand and consumed daily intake stay consumed. No booking/offer state or revision is changed by distribution.
- **UC-012-AC04:** A fully distributed item leaves the distribute-first stock list and the donor sees the resulting status in-app. Partial distribution is outside this MVP; competing full-lot commands produce only one movement.

### UC-015 — Withdraw, expire, cancel and re-offer

**Actors:** donor; target personnel; deterministic timeout code. **Features:** FEAT-009, FEAT-022. **Preconditions:** an unreceived item/attempt, current permissions and expected resource revision.

**Flow:** close the attempt with a reason, terminal booking if present and append-only event; release every unreceived hold atomically. Whole-item withdrawal leaves the item withdrawn; restoring validated facts makes it ready. Refusal/cancellation/timeout otherwise leaves it ready for correction and a new offer. Before replacement, materialize any due active row under the same locks.

**Alternatives:** a receipt that commits first makes withdrawal/cancellation invalid. Deadline-aware availability works without reconciliation; a bounded reconciliation command later records effective cutoff versus recording time. Terminal attempts and original decisions cannot be reset or deleted.

- **UC-015-AC01:** At review/approval/reception deadline equality, the attempt is effectively expired; no stale status can reserve resources indefinitely, even with no cleanup process.
- **UC-015-AC02:** Booking cancellation/no-show releases demand, storage, quota and appointment holds exactly once, preserves prior approval, and allows a new attempt with the same donation ID.
- **UC-015-AC03:** Simultaneous cancel/receive or expire/receive serializes; receipt after cutoff fails, and no donation is both returned to ready and physically received.
- **UC-015-AC04:** After offer to A closes and donor edits/re-offers to B, A sees only its own frozen facts and whitelisted evidence; B sees its own attempt; neither sees the other's future facts.
- **UC-015-AC05:** A pending analysis never blocks a complete human-entered donation. Its late result retains originals and can attach a missing basis but cannot overwrite human facts, offer snapshots, reservations or a human decision.

### UC-016 — Manage and recover association membership

**Actors:** active association admin; existing enabled account; platform admin for constrained recovery. **Feature:** FEAT-023. **Preconditions:** approved association and freshly verified database permissions.

**Flow:** grant a role using an existing profile UUID, or change/revoke membership with its revision; append an audit event. Atomic transfer enables the target admin and demotes the initiator to staff. If no active enabled admin remains, platform may manually verify and reactivate the original applicant, with a mandatory reason.

**Alternatives:** no email invitation/lookup; staff cannot manage members; revocation cannot remove the last enabled admin. Platform recovery with an arbitrary target or while an enabled admin exists fails.

- **UC-016-AC01:** Client metadata, profile PATCH and registration cannot assign a privileged platform role or an arbitrary initial admin; approval activates only the recorded applicant.
- **UC-016-AC02:** Last-admin demotion/revocation fails, including concurrent changes; transfer is atomic and every successful change appends membership history.
- **UC-016-AC03:** Once revocation commits, later data requests, writes and idempotent replays fail despite an unexpired JWT; roster reads expose only member UUID/role/activity.
- **UC-016-AC04:** Orphan recovery reactivates only the original applicant after verification/reason, grants no donation read and is audited; it is denied while any enabled active admin exists.

## Optional and post-MVP acceptance boundaries

These criteria do not expand the required MVP or override its cut order.

### UC-013 — Evaluate optional providers and compare results

**Actors:** technical operator configuring providers; donor/staff viewing indicators. **Features:** FEAT-016, FEAT-017. **Priority:** S1/S2. **Preconditions:** baseline passes, Jev image viability/contract sourcing resolved (AMB-018), comparison set defined.

**Flow:** configure the optional provider; request validated indicators; retain attributable results; optionally show a comparison. **Failure path:** explicitly show provider failure rather than changing the human decision or silently fabricating extraction. No automatic failover policy is specified.

- **UC-013-AC01:** With OpenAI-only configuration, the full M flow works without Jev credentials or a Jev call.
- **UC-013-AC02:** When enabled, Jev handles only probability indicators; hybrid extraction comes from OpenAI. Jev image requests include the required experimental header and every result satisfies the shared contract under the agreed sourcing policy.
- **UC-013-AC03:** Comparison retains provider/model attribution and original values separately; it sets no decision, labels no provider as truth and never inserts a model into matching.

### UC-014 — Inspect optional reporting

**Actor:** association personnel. **Features:** FEAT-018, FEAT-019, reporting part of FEAT-020. **Priority:** S3/S4/P. **Preconditions:** M flow passes and metric definitions/data sources are agreed (AMB-014/AMB-020).

**Flow:** select a scope; compute the agreed report in code from attributable facts/events; show missing-data limitations alongside estimates. **Failure path:** unsupported metrics remain unavailable rather than receiving invented formulas or weights.

- **UC-014-AC01:** The expiry timeline uses the same date interpretation and stock/filter scope as the list, and persists no derived expiry values.
- **UC-014-AC02:** Agreement reporting specifies indicator labels, annotation source, included samples and denominator; approval/refusal is not automatically an indicator truth label.
- **UC-014-AC03:** Impact values distinguish measured quantities from estimates and use agreed code-computed formulas. No kg, disposal-cost factor, prevention count or accuracy rate is supplied by a model or invented for a demo.

Non-reporting discovery, verification, partnerships, channels and logistics remain roadmap candidates. Detailed acceptance criteria require a separately agreed post-MVP scope; no external messages, verification API, map, transfer or routing implementation is authorized by this documentation.

## Traceability matrix

Each feature maps to all requirements it directly implements or constrains. All BR/FR/NFR IDs in requirements.md appear here, including optional/deferred requirements; cross-cutting requirements intentionally appear more than once. Use the cited UCs for behavior and the NFR rows in requirements.md for checks that span use cases.

| Feature | Priority | Functional requirements | Business / non-functional requirements | Use cases / acceptance coverage |
|---|---|---|---|---|
| FEAT-001 | M | FR-001, FR-002 | BR-001, BR-006; NFR-001, NFR-002, NFR-007 | UC-001 |
| FEAT-002 | M | FR-003, FR-004 | BR-002; NFR-001, NFR-006, NFR-008 | UC-002 |
| FEAT-003 | M | FR-005, FR-006, FR-034 | BR-003; NFR-001, NFR-004 | UC-002, UC-010, UC-012 |
| FEAT-004 | M | FR-007 | NFR-001, NFR-002, NFR-003, NFR-007 | UC-003 |
| FEAT-005 | M | FR-008, FR-009 | BR-001, BR-002, BR-004, BR-005; NFR-002, NFR-006, NFR-008, NFR-009 | UC-004 |
| FEAT-006 | M | FR-010, FR-011, FR-018, FR-038 | BR-001, BR-002; NFR-004, NFR-005 | UC-005, UC-008 |
| FEAT-007 | M | FR-013, FR-014, FR-034 | BR-003, BR-006; NFR-001, NFR-004, NFR-006, NFR-009 | UC-006, UC-007 |
| FEAT-008 | M | FR-009, FR-012 | BR-001, BR-004, BR-005, BR-006; NFR-007 | UC-004, UC-006 |
| FEAT-009 | M | FR-015, FR-025, FR-033, FR-036 | BR-001, BR-006; NFR-001, NFR-004 | UC-007 |
| FEAT-010 | M | FR-016, FR-017 | BR-001, BR-004, BR-005; NFR-001, NFR-004, NFR-005, NFR-009 | UC-008 |
| FEAT-011 | M | FR-018, FR-019, FR-020 | BR-002; NFR-005, NFR-008, NFR-009 | UC-009 |
| FEAT-012 | M | FR-006, FR-023 | BR-001, BR-006; NFR-001, NFR-004, NFR-007 | UC-010 |
| FEAT-013 | M | FR-024, FR-025 | BR-001, BR-006; NFR-001, NFR-004 | UC-011 |
| FEAT-014 | M | FR-005, FR-022 | BR-002; NFR-001, NFR-004 | UC-012 |
| FEAT-015 | M | FR-021, FR-020 | BR-001, BR-002; NFR-001, NFR-007 | UC-009 |
| FEAT-016 | S1 | FR-026 | BR-001, BR-002; NFR-002, NFR-006, NFR-008, NFR-010 | UC-013 |
| FEAT-017 | S2 | FR-027 | BR-001; NFR-005, NFR-010 | UC-013 |
| FEAT-018 | S3 | FR-028 | BR-002; NFR-010 | UC-014 |
| FEAT-019 | S4 | FR-029 | BR-001, BR-002; NFR-010 | UC-014 |
| FEAT-020 | P | FR-030, FR-031 | BR-001, BR-002; NFR-010 | UC-014 for reporting; later discovery/verification scope TBD |
| FEAT-021 | P | FR-032 | BR-006; NFR-010 | Excluded from MVP; future scope/criteria TBD |
| FEAT-022 | M | FR-033, FR-035, FR-036, FR-038 | BR-001, BR-002; NFR-001, NFR-004, NFR-005 | UC-015 |
| FEAT-023 | M | FR-001, FR-002, FR-037 | BR-006; NFR-001, NFR-002, NFR-004 | UC-001, UC-016 |
| FEAT-024 | M | FR-039 | BR-002, BR-003; NFR-001, NFR-002, NFR-007 | UC-017 |

## Delivery priorities and forty-hour budget

Keep every M capability in its smallest usable form. Reuse one photo/detail view across donor, review and gallery; use a basic form/list rather than an advanced dashboard; keep light stock rather than a warehouse module. These are scope recommendations, not new UI requirements. All five category schemas remain in the baseline. The default provider is OpenAI; Jev and comparison are optional.

The following is an **illustrative planning allocation**, not evidence that the project is implemented or that these estimates are achievable. Hours are a total project effort budget, not per-developer allocations. No optional work is budgeted; stretch begins only if the required flow and checks finish early.

| Work package | Features | Proposed hours |
|---|---|---:|
| Foundation, auth/bootstrap, memberships, constraints/RLS and approval | FEAT-001, FEAT-023 | 7 |
| Needs, independent storage/intake budgets, hours/slots | FEAT-002, FEAT-003 | 4 |
| Uploads, five schemas, indicators, corrections and late-response safety | FEAT-004–FEAT-006, FEAT-008 | 6 |
| Geocoding, deterministic matching, reusable offers and timeout recovery | FEAT-007, FEAT-009, FEAT-022 | 5 |
| Human review and atomic finite holds | FEAT-010 | 3 |
| Booking, cancellation/no-show and QR reception | FEAT-012, FEAT-013 | 4 |
| Light stock, full distribution, expiry/FEFO and basic gallery | FEAT-011, FEAT-014, FEAT-015 | 4 |
| RLS/concurrency/race tests, photo set, integration and demo | All M features | 5 |
| Remaining decisions and integration contingency | All M features | 2 |
| **Total** | **Required MVP only** | **40** |

Resolve the blocking ambiguities before implementing their dependent policies, especially upload limits, retention and deployment/model/device budgets. Analysis-v1 and expiry-v1 now supply the category/indicator/safety/date defaults; verify those contracts rather than inventing substitutes. Core auth/budget/lifecycle/recovery defaults are now defined; product changes to them must update all contracts together. If estimates slip, simplify presentation and remove optional work in the exact AGENTS order: **Jev → provider comparison → expiry timeline → AI/human agreement metric**. Removing Jev also removes its dependent comparison. Do not cut indicators, expiry buckets/distribute-first, review queue, QR reception or auth/RLS. If the baseline still exceeds the budget, surface that constraint for a scope decision rather than calling an incomplete flow done.

Post-MVP contains advanced reporting/impact and discovery/verification/partnership work. External channels and logistics require a separate later authorization; their presence on the roadmap adds no requirement to the MVP.

## Acceptance and verification plan

| Check | Evidence needed at application delivery | Coverage |
|---|---|---|
| Expiry arithmetic | Deterministic unit tests with explicit reference dates: today, expired, unreadable, 7/30/90 boundaries, timezone/calendar PAO and exact expiry-v1 boundaries | BR-002; FR-018–FR-020; UC-009 |
| Matching | Unit tests for independent demand/storage/intake/place exhaustion, season, deterministic ties and distance order; same input gives same result without provider calls | BR-003; FR-013–FR-014; UC-006 |
| Analysis | Schema parsing checks and 25–35 local fixture photos including medicines/para; inspect indicators, unknown facts and warnings rather than approval outputs | BR-001/BR-004/BR-005; FR-007–FR-011; UC-003–UC-005 |
| Isolation and immutability | Two donors/two associations; direct read/write attempts across boundaries; original-result mutation rejected; secrets absent from client output | FR-001; NFR-001–NFR-005; UC-001/UC-003/UC-005/UC-008 |
| Lifecycle and concurrency | Staff-only decision; one active attempt; deadline equality without jobs; cancellation/re-offer; last-quota/slot contention; cross-attempt receipt/distribution uniqueness; stale JWT revocation/last-admin and delayed analysis races | NFR-004; UC-007/UC-008/UC-010–UC-012 |
| Full flow | Own item → corrected facts → match → offer → staff review → booking/QR → staff reception → distribution, with in-app donor status and FEFO/gallery | All M features |
| Product language and exclusions | Every AI view uses indicator wording; human decision identified; no transport, routing, donation notification emails or messaging paths; account confirmation allowed | BR-001, BR-006 |
| Repository checks | Frontend pnpm lint/typecheck/test/build and backend Ruff/mypy/pytest pass for changed components; photo fixtures are present and exercised | NFR-009 |

These acceptance specifications have backend implementation and automated evidence in [readiness](readiness.md). The connected frontend and its package scripts now exist. Hosted email/password authentication, API flows and model/photo evaluation remain delivery gates. Documentation review checks that IDs are unique, all requirements are traceable, links resolve, priorities respect AGENTS.md and ambiguities remain explicit.

## Two-blocker contract revision

The [analysis rules](analysis-rules.md), [expiry rules](expiry-rules.md) and [rule scenarios](rules-test-cases.md) define these details without new services, tables, columns, routes, states or a new testing toolchain. Existing UC-008/010/011/012 physical commands additionally enforce their current-date restrictions/acknowledgements and planned-slot dates. Keep the 40-hour allocation and optional cut order; model calibration, configurable per-association expiry policies and extra category fields remain post-MVP.
