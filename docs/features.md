# Dono features and use cases

Status: proposed delivery specification for a ≤40-hour hackathon MVP. The [requirements](requirements.md) define authority, actors, permissions, business rules and unresolved decisions. AGENTS.md overrides this document if any conflict is found.

`FEAT` identifies a feature, `UC` a use case, and `UC-…-AC…` a uniquely identified acceptance criterion. M is required MVP; S1–S4 are optional work removed in that order; P is post-MVP. Criteria describe future observable behavior, not completed tests. Any criterion dependent on an `AMB` decision is conditional on resolving that decision; it does not choose a default.

## Feature catalog

| ID | Feature | Priority | Minimum deliverable / boundary |
|---|---|---|---|
| FEAT-001 | Identity, roles and association approval | M | Donor/staff isolation and platform approval of RNA/SIRET association registrations. No general platform access to donation decisions. |
| FEAT-002 | Needs capture | M | Structured form plus editable free-text parsing draft. Staff confirm the final need. |
| FEAT-003 | Capacity, hours and slots | M | Per-category intake capacity and bookable drop-off slots, using agreed units and reservation rules. |
| FEAT-004 | Donation photo capture | M | Mobile-browser capture/upload, food/para label close-up and server validation before provider calls. |
| FEAT-005 | Category-specific analysis | M | OpenAI structured extraction, condition/risk indicators and confidence for all five categories. No AI decisions. |
| FEAT-006 | Editable facts and category, preserved evidence | M | A working category/fact set distinct from immutable original analysis and indicators, with visible corrections. |
| FEAT-007 | Deterministic matching | M | Need, capacity and season eligibility plus Haversine distance and code-generated reasons. |
| FEAT-008 | Warnings and other options | M | Medicine/pharmacy and chilled/frozen-food warnings; textile/repair/pharmacy redirect list without communications. |
| FEAT-009 | Offers and My donations | M | Send an offer and read staff decision, booking, reception and distribution status in-app. |
| FEAT-010 | Association review queue | M | Photos, evidence/corrections, expiry and explicit staff approve/refuse action. |
| FEAT-011 | Expiry and distribute-first list | M | Read-time days/buckets, unknown-date visibility and FEFO for received undistributed stock. |
| FEAT-012 | Drop-off booking and donor QR | M | Book only an approved offer into a slot with space; retrieve appointment/QR in-app. |
| FEAT-013 | Today's arrivals and QR reception | M | Association-scoped appointments, authenticated validation and explicit reception without duplicate effects. |
| FEAT-014 | Light inventory and distribution | M | Received stock and distribution movements with coherent needs/capacity updates. |
| FEAT-015 | Basic image and expiry dashboard | M | Photo gallery, indicator overlays, basic filters, expiry counts and link to the distribute-first list. |
| FEAT-016 | Jev / hybrid providers | S1 | Optional probabilities behind provider selection; OpenAI handles extraction. No unresolved Jev-only behavior in the baseline. |
| FEAT-017 | Provider comparison | S2 | Attributable OpenAI/Jev indicator comparison; no automatic quality verdict. Depends on FEAT-016. |
| FEAT-018 | Expiry timeline | S3 | Chart of code-computed date information under the same resolved bucket/date policy. |
| FEAT-019 | AI/human agreement metric | S4 | Reporting only with an agreed annotation and denominator definition. |
| FEAT-020 | Advanced metrics, impact and discovery | P | Average shelf life, impact dashboard, automatic registration verification, visual map and partnerships. The reviewed README follows this proposed deferral; AMB-020 still records the product scope decision. |
| FEAT-021 | External channels and logistics | P | Future scope candidates only: notifications/email, messaging, association transfers, pickups and routing. No MVP integrations, screens or background jobs. |
| FEAT-022 | Company donations | M | Existing donor workflow with company-name attribution and the same unopened ambient-food rules. No company verification, shared accounts, tax receipts or cold-chain handling. |

## Lifecycle and evidence boundaries

The source-backed happy path is recorded below. “Draft” is a descriptive pre-offer stage, not a newly mandated persisted status. Analysis readiness, donation decision, booking and inventory are separate concepts; exact physical representation remains an implementation choice.

| Stage / transition | Authorized actor | Guard / effect |
|---|---|---|
| Capture → analysis/corrections before offer | Donor for own item; server invokes provider | Valid uploads; preserve original analysis separately from working facts. No staff decision exists yet. |
| Ready item → offered | Donor | Target association approved; deterministic matching revalidated. No stock receipt. |
| Offered → approved OR refused | Target-association personnel | Explicit human action; required eligibility/capacity checks. Refusal does not lead to booking. |
| Approved → booked | Donor | Available target-association slot; consistent booking and associated QR. |
| Booked → received | Target-association personnel | Validate QR and booking; enter the actual positive quantity up to the offered quantity; atomically audit any reduction, close reception and add stock once. |
| Received → distributed | Target-association personnel | Record actual distribution under the agreed quantity model; remove stock without negative balance. |

Reception closes once at the corrected actual quantity, with no pending remainder or second receipt. The original offered quantity stays in the audit. General post-offer corrections, cancellation, re-offering, multiple simultaneous offers, approval reversal and partial distribution remain open. Approval reservation/release and medicine refinements are on standby. AI results never drive an approve/refuse transition. Booking does not imply physical receipt. All local dates and appointments use `Europe/Paris`.

## Detailed MVP use cases

### UC-001 — Authenticate and enable an association

**Actors:** donor, association applicant, platform admin. **Features:** FEAT-001. **Trigger:** a person signs in or submits an association registration.

**Preconditions:** the authentication method and applicant bootstrap have been agreed without adding outbound email (AMB-002).

**Main flow:** authenticate the person; identify authorized role/membership; collect the association's agreed RNA/SIRET fields; show the registration for manual platform review; record platform approval; permit the approved association to participate in matching.

**Alternatives:** unauthenticated requests cannot read protected records; a pending registration remains outside new matched offers; rejection/resubmission and membership administration await AMB-001/AMB-002.

**Postcondition:** the user has only the permissions of their role and membership, and association approval is separate from donation decisions.

Acceptance criteria:

- **UC-001-AC01:** Given donors A and B, when A requests B's donation, analysis, photo, booking or QR by direct identifier, access is denied without disclosure.
- **UC-001-AC02:** Given personnel for associations X and Y, X cannot read or mutate Y's offers, needs, capacity, slots, stock or photos through UI or direct API/data requests.
- **UC-001-AC03:** Given a pending association, it is absent from new matching results until a platform admin manually approves its registration.
- **UC-001-AC04:** A donor cannot self-assign a privileged role through editable account metadata; association approval grants no platform permission to decide donations.
- **UC-001-AC05:** Sign-in and registration add no email/messaging dependency. The final permission split for management screens is tested only after AMB-001/AMB-002 are resolved.

### UC-002 — Configure needs, capacity and drop-off availability

**Actors:** association admin; association staff only where authorized. **Features:** FEAT-002, FEAT-003. **Trigger:** the association updates what it needs or can receive.

**Preconditions:** authorized association membership; agreed quantity/capacity units, season vocabulary and slot policy (AMB-001, AMB-008–AMB-011).

**Main flow:** enter a need in the form or paste free text; review a parsed draft if used; confirm structured values; set category capacity; configure hours and drop-off slots; save and expose the current configuration to matching and booking.

**Alternatives:** a parsing failure returns to the form without inventing quantities; invalid values cannot become active configuration; booked-slot edits require the policy in AMB-010.

**Postcondition:** confirmed association configuration is current and scoped to the association; reservations and stock stay distinct from configured limits.

Acceptance criteria:

- **UC-002-AC01:** Given free text with a stated item quantity, parsing preserves the stated quantity for staff review; no need becomes active before confirmation and no derived quantity is calculated by AI.
- **UC-002-AC02:** If parsing fails or an attribute is missing, staff can complete the same need through the form; the system does not fabricate season or quantity.
- **UC-002-AC03:** Before a need has commitments or receipts, valid changes affect subsequent matching. After an approved/booked commitment or receipt, attempts to change its category, unit, matching attributes or seasons fail. Close that need and create a new one for different criteria; old receipts do not fulfill it.
- **UC-002-AC04:** Given capacity is full under the agreed reservation policy, the association is ineligible for additional matching in that category and competing operations cannot overcommit it.
- **UC-002-AC05:** Only authorized members of the association can change its needs/capacity/slots; slot availability respects its configured hours and agreed booking limits.
- **UC-002-AC06:** A criteria edit racing with approval uses the same write locks. Either the edit wins and approval rechecks it, or approval wins and the criteria edit fails. The two commands cannot commit incompatible criteria and commitments.

### UC-003 — Capture an item and validate its photos

**Actor:** donor. **Feature:** FEAT-004. **Trigger:** the donor starts a scan.

**Preconditions:** signed-in donor; configured upload formats/limits and photo-count rule (AMB-003).

**Main flow:** enter one product type and its quantity; split groups with different category, matching attributes or expiry facts; capture item photos and a food/para label close-up; validate files on the server; retain scoped photo references for analysis.

**Alternatives:** unsupported/oversized files show an actionable error before any provider call; an unreadable label remains unknown and can be corrected with better evidence. Camera/file selection behavior follows the supported browser decision.

**Postcondition:** valid photos belong to the donor's item and are available only to authorized readers.

Acceptance criteria:

- **UC-003-AC01:** Configured file limits are enforced on the server even if a client-side control is bypassed; rejected files are not sent to a model.
- **UC-003-AC02:** The food/para capture flow requests a readable date/product label close-up and follows the photo cap agreed in AMB-003.
- **UC-003-AC03:** Another donor or unrelated association cannot obtain the photo through a guessed storage path or donation identifier.
- **UC-003-AC04:** A failed upload shows failure and allows correction/retry without presenting an analysis result or successful offer.
- **UC-003-AC05:** Six identical sealed pasta packs with one expiry date can share one donation. Packs with two dates require separate donations before offering. Mixed products or garment sizes also require separate donations.

### UC-004 — Read category-specific analysis and safety indicators

**Actors:** donor; analysis service. **Features:** FEAT-005, FEAT-008. **Trigger:** validated item photos are analyzed.

**Preconditions:** OpenAI configured server-side; schema/indicator vocabulary agreed (AMB-017).

**Main flow:** call the category-specific extraction/indicator provider; validate its result; preserve the original result and provenance; show extracted facts, indicators and confidence; display applicable medicine/cold-food warnings and other options.

**Alternatives:** failed/schema-invalid analysis shows an error and permits retry without fabricated results; low-confidence or unknown facts stay visibly uncertain. Medicine-warning thresholds and the clarification/blocking workflow await AMB-007. Confirmed medicines remain outside donation scope.

**Postcondition:** usable evidence is available to the donor and later to authorized association reviewers; no donation decision has been made.

Acceptance criteria:

- **UC-004-AC01:** Successful output conforms to `AnalysisResult` in AGENTS.md and preserves provider, model, one of the five categories, extracted facts, indicators and confidence.
- **UC-004-AC02:** Clothes support type/size/season and wear/stains/holes/pilling; shoes support size/pair/sole/upper evidence; food supports product/date/type and packaging; para supports seal/expiry/PAO/medicine concern; furniture supports type/size class/damage. Missing evidence remains unknown.
- **UC-004-AC03:** Indicator copy such as “Stains likely — 61%” is distinguishable from human decision status. No analysis card/button/response says the AI accepted or refused an item, and no analysis call sets `decision`.
- **UC-004-AC04:** A high medicine indicator visibly warns and points to a pharmacy. Changing the working category cannot erase the original warning or create an exception allowing a confirmed medicine donation.
- **UC-004-AC05:** Chilled/frozen-food concern produces a visible warning. Confirmed chilled/frozen food is outside the smaller MVP scope for both individual and company donors. Medicine warning refinements remain on standby under AMB-007.
- **UC-004-AC06:** Schema-invalid output or provider failure creates no fabricated confidence, date or decision. The required 25–35-photo evaluation includes medicines and para, with expected indicator behavior recorded rather than an AI acceptance verdict.
- **UC-004-AC07:** The analysis heading asks the donor to check details and shows estimated indicators. It does not say the item is ready or suitable to donate. Only the later staff action creates an approval/refusal.
- **UC-004-AC08:** Staff cannot approve packaged food/para confirmed opened or with unknown packaging eligibility. Printed PAO can remain in the original analysis, but neither the donor nor staff supplies an opening date to make an opened product eligible.

### UC-005 — Correct category or facts without changing AI evidence

**Actor:** donor; authorized reviewer reads corrections. **Feature:** FEAT-006. **Trigger:** the donor spots an incorrect size, category, date or other extracted fact.

**Preconditions:** an original result is retained; the item is in an editable stage under AMB-004. Pre-offer correction is required; later edit rights remain undecided.

**Main flow:** inspect original and working values; edit working category/facts; validate the correction; retain its human attribution separately; recompute derived expiry/matches from current valid facts; show both versions to reviewers. Follow the agreed reanalysis policy after category changes.

**Alternatives:** invalid date/field input shows an error and does not replace valid working facts; incompatible old category-specific indicators remain labeled with their original category; failed reanalysis cannot overwrite earlier output.

**Postcondition:** working facts reflect the correction while original extracted values, indicators and confidence remain intact.

Acceptance criteria:

- **UC-005-AC01:** Given an original `clothes` category and an allowed correction to `shoes`, the working category changes while the original category/result/indicators remain unchanged and identifiable.
- **UC-005-AC02:** Given an incorrectly extracted date or size, the donor can correct the working fact; later matching/expiry reads use the validated correction and the review screen shows the difference.
- **UC-005-AC03:** Requests to edit original probability, indicator level, confidence, model or provider are rejected, including direct requests that bypass the UI.
- **UC-005-AC04:** If reanalysis occurs, both results remain attributable; a new run does not replace or relabel old category-specific indicators. No reanalysis policy is assumed before AMB-004 is resolved.
- **UC-005-AC05:** Editing category or facts cannot directly set a staff decision, erase an original warning or silently change an already-reviewed offer; the post-offer policy is explicitly resolved and tested first.

### UC-006 — Match a donation or view other options

**Actors:** donor; deterministic matching/geocoding services. **Features:** FEAT-007, FEAT-008. **Trigger:** the donor asks where to offer the item.

**Preconditions:** validated working category/facts and locations; approved candidate associations; agreed matching/season/radius policy (AMB-009/AMB-016).

**Main flow:** geocode the necessary address; read needs/capacity/season; compute eligibility and Haversine distance; show deterministic results/reasons in the agreed distance order; let the donor select a target or read other options.

**Alternatives:** no eligible association shows an explicit empty result and redirect points; unavailable location/geocoding does not yield invented distances; warnings and confirmed-item exclusions still apply. A selected target whose capacity changes is revalidated when offering.

**Postcondition:** the donor has a suitable target or a clear no-match/other-options result; no staff decision has been inferred.

Acceptance criteria:

- **UC-006-AC01:** Repeating matching with identical facts, association configuration and coordinates returns the same results and order; the matching path makes no model call.
- **UC-006-AC02:** Full category capacity, unmet need eligibility and incompatible season each affect eligibility according to the agreed policy; none is ignored in favor of distance alone.
- **UC-006-AC03:** For otherwise equivalent eligible associations with different coordinates, code-computed Haversine distances determine the agreed distance order. Radius/weight/tie cases are tested after AMB-009 is resolved.
- **UC-006-AC04:** Failed geocoding or unknown coordinates are shown explicitly; the system does not invent a “nearby” result, route or travel time.
- **UC-006-AC05:** Zero results offers other-options information, including pharmacy redirection for medicine concern. It does not offer a pickup, send a message or create an external reservation.
- **UC-006-AC06:** The donor receives only the agreed association listing fields; matching does not grant access to raw private needs/capacity/membership records.

### UC-007 — Submit an offer and follow its status

**Actor:** donor. **Feature:** FEAT-009. **Trigger:** the donor selects a matched association and offers the item.

**Preconditions:** owner authenticated; current facts/evidence available; target association approved; offer cardinality policy agreed (AMB-012).

**Main flow:** revalidate current target eligibility/capacity; submit the offer; make it visible in the target queue; show offered status in My donations; reflect later staff, booking and inventory events in-app.

**Alternatives:** a stale/ineligible target produces a conflict and refreshed matching rather than successful submission; retries do not create unintended duplicates; re-offering/withdrawal is unspecified until AMB-012 is resolved.

**Postcondition:** the donor owns a traceable offer to the target association; it is not approved merely because submission succeeded.

Acceptance criteria:

- **UC-007-AC01:** A submitted offer appears in its owner's My donations and only the addressed association's review queue; it initially has no AI-made approval/refusal.
- **UC-007-AC02:** If target approval, need or capacity eligibility changes before commit, submission is revalidated and does not report a stale success.
- **UC-007-AC03:** Human approved/refused, booked, received and distributed states become visible in-app to the donor, with refusal as a branch that cannot be booked.
- **UC-007-AC04:** Repeated submission caused by retry does not create unintended duplicate offers; no email or messaging notification accompanies a state change.

### UC-008 — Review an offer and record a human decision

**Actor:** authorized target-association admin/staff. **Feature:** FEAT-010. **Trigger:** personnel open the review queue.

**Preconditions:** addressed offer exists; reviewer is an authorized member; capacity and restriction policy agreed where needed (AMB-007/AMB-008).

**Main flow:** inspect photos; compare original indicators/category/facts with working corrections; read confidence and code-computed expiry/warnings; check current capacity/need; explicitly approve or refuse; persist the reviewer attribution and display the human decision.

**Alternatives:** a competing decision or changed capacity produces a conflict; an unknown date remains unknown; confirmed medicines cannot be approved as an exception. Reasons, reversal and handling of expired/DLC/DDM offers remain open.

**Postcondition:** the offer has an authorized human decision; immutable AI evidence is unchanged.

Acceptance criteria:

- **UC-008-AC01:** The reviewer sees photos, original indicators/confidence, corrections, current category, applicable warnings and read-time expiry information before deciding.
- **UC-008-AC02:** Only authorized target-association personnel can set `decision`; donor/provider/unrelated-association requests are denied.
- **UC-008-AC03:** A successful decision records the human actor. Its UI label identifies association approval/refusal separately from AI estimates.
- **UC-008-AC04:** Concurrent conflicting review actions cannot silently overwrite one another or overcommit the agreed capacity allocation; the losing request refreshes the current state.
- **UC-008-AC05:** Approving/refusing changes neither original indicators nor their probabilities. A confirmed medicine cannot proceed through an approval override; expired-item handling follows the explicitly agreed policy rather than an AI verdict.

### UC-009 — Inspect photos, expiry buckets and distribute-first stock

**Actor:** association personnel. **Features:** FEAT-011, FEAT-015. **Trigger:** staff inspect the image/expiry dashboard or decide which stock to distribute first.

**Preconditions:** scoped donations/stock; `Europe/Paris` reference date; agreed bucket, date normalization and metric scope (AMB-005/AMB-006/AMB-014).

**Main flow:** open the gallery; filter category/indicator/expiry; inspect original vs corrected facts; calculate days/expired/buckets from source facts at read time; inspect expired/unknown counts; view received undistributed items in FEFO order.

**Alternatives:** unreadable/ambiguous dates are explicit; a printed PAO alone does not create an expiry date for an unopened product; offered/refused/unreceived items do not appear as received stock in distribute-first.

**Postcondition:** staff can prioritize actual stock using current calculations; no derived expiry values have been persisted.

Acceptance criteria:

- **UC-009-AC01:** An item with a valid source date changes its days-left/bucket display as the reference date changes, without updating a stored derived value or invoking a model for arithmetic.
- **UC-009-AC02:** Today, yesterday/expired, unreadable date and values at 7, 30 and 90 days have explicit expected outcomes under the resolved policy. The document does not assign exactly 90 days or “today” silently.
- **UC-009-AC03:** Missing/unreadable dates remain visible as unknown, never zero days or an invented long shelf life; date type DLC/DDM/expiry/PAO remains visible where known.
- **UC-009-AC04:** For usable dates on received undistributed stock, earlier expiry precedes later expiry in distribute-first. Unknown/PAO-only placement follows AMB-006, and fully distributed items leave the list.
- **UC-009-AC05:** Gallery overlays show original indicators as estimates and corrections separately; filters/counts share an explicit data scope and avoid duplicate counting under the chosen bucket interpretation.
- **UC-009-AC06:** The reference date changes at midnight in `Europe/Paris`, including daylight-saving changes. Reading from a browser in another timezone does not change the donation's local reference date. An unopened PAO-only product has no computed after-opening date.

### UC-010 — Book an approved drop-off and retrieve its QR

**Actor:** donor. **Feature:** FEAT-012. **Trigger:** the donor books a staff-approved offer.

**Preconditions:** own staff-approved offer, target-association slots in `Europe/Paris`, and agreed remaining slot/QR policy (AMB-010/AMB-013).

**Main flow:** choose an available slot; recheck offer state and slot limit; commit booking consistently; generate the booking QR; display association drop-off location, appointment time and QR in My donations.

**Alternatives:** a taken slot offers refreshed availability; unapproved/refused/foreign offers cannot be booked; cancellation/rescheduling awaits AMB-010/AMB-012. No transport is arranged.

**Postcondition:** a confirmed booking occupies the agreed slot allocation and its QR is retrievable by its donor.

Acceptance criteria:

- **UC-010-AC01:** Offered or refused items cannot be booked; the donor can book only their own approved offer at its target association.
- **UC-010-AC02:** Given two concurrent requests for the last available slot allocation, only the permitted booking succeeds and the other sees refreshed availability.
- **UC-010-AC03:** After a confirmed booking, the owner can reload appointment and QR in-app; confirmation does not depend on email or messaging.
- **UC-010-AC04:** The appointment identifies donor drop-off at the association, without pickup, carrier selection, routing or delivery tracking.
- **UC-010-AC05:** Before staff approval, slot confirmation and QR retrieval are unavailable. After approval, the donor selects a slot and confirms it. Only a successful booking creates a retrievable QR; selecting a slot alone does not.
- **UC-010-AC06:** If QR retrieval fails after booking succeeds, the appointment remains booked. Retrying QR retrieval does not create another booking or consume another slot place.

### UC-011 — Receive a booked donation using QR

**Actors:** association personnel; donor presents the QR. **Feature:** FEAT-013. **Trigger:** the donor arrives with the item.

**Preconditions:** authenticated target-association staff; a valid current booking; reception exception policy agreed (AMB-013).

**Main flow:** read today's arrivals; validate the QR and booking; inspect the linked offer; keep or reduce its quantity to the actual positive quantity present; confirm once. Commit any quantity correction and its audit with the receipt, stock and received status in one transaction; reflect the result in the donor's status.

**Alternatives:** malformed/foreign/already-received QR shows failure/current state without adding stock. An increased or zero quantity cannot create a receipt. A reduced quantity closes the entire reception; no remainder is scheduled. Zero/no-show handling is on standby. Camera failure, early/late arrival and item mismatch remain AMB-013.

**Postcondition:** physical reception is recorded once with staff attribution and the agreed capacity/need effects. A QR scan alone does not approve an offer.

Acceptance criteria:

- **UC-011-AC01:** Today's list is scoped to the association and the agreed date/timezone, with booking/item and reception state available.
- **UC-011-AC02:** A QR from association X cannot be received by Y's personnel; an unauthenticated QR request grants no reception permission or private booking details.
- **UC-011-AC03:** A valid scan resolves the intended booking for staff confirmation; receipt commits once and the owner sees received status in-app.
- **UC-011-AC04:** Repeated/concurrent scans or a retry after successful reception produce no duplicate inventory movement, need decrement or capacity effect.
- **UC-011-AC05:** Invalid QR/state shows failure/current state and changes no stock; QR validation cannot change original AI indicators or set a new donation approval.
- **UC-011-AC06:** For an offer of three identical units, staff can enter two and confirm once. The working quantity becomes two, the audit retains three as the original offered quantity, stock gains two and status becomes received in one commit. There is no pending third unit or second receipt.
- **UC-011-AC07:** For that three-unit offer, entering four, zero or an invalid quantity changes no state. A stale revision changes no state. Replaying the successful two-unit confirmation returns the same event without another correction or stock movement.

### UC-012 — Record distribution and maintain light stock

**Actor:** authorized association personnel. **Feature:** FEAT-014. **Trigger:** received items are distributed.

**Preconditions:** received stock; agreed units, partial-quantity support and capacity/need lifecycle (AMB-008).

**Main flow:** inspect stock, including distribute-first guidance; select the received item/quantity; record actual distribution; update remaining stock and relevant capacity/need state in code; show distributed status when its agreed completion condition is met.

**Alternatives:** offered/booked/unreceived items cannot be distributed from stock; excessive/duplicate distribution is rejected or returns the existing result; correction/reversal rules require an explicit later decision.

**Postcondition:** remaining inventory reflects actual recorded movements and cannot be negative; donor status reflects the agreed lifecycle.

Acceptance criteria:

- **UC-012-AC01:** Only received stock in the member's association can be distributed; donations still offered, refused or booked do not count as received inventory.
- **UC-012-AC02:** Reception adds and distribution removes the agreed quantity once; repeated or competing distribution cannot exceed the remaining quantity.
- **UC-012-AC03:** Needs and available capacity update consistently with the policy resolved in AMB-008, with no double decrement between approval, reception and distribution.
- **UC-012-AC04:** A fully distributed item leaves the distribute-first stock list and the donor sees the resulting status in-app. Partial-quantity behavior is tested only if included in the agreed policy.

### UC-015 — Offer on behalf of a company

**Actor:** authenticated donor. **Feature:** FEAT-022. **Trigger:** the donor offers a company's goods.

**Main flow:** choose company attribution and enter its name; capture one product type with identical units; follow the same matching, staff review, slot selection, QR and reception flow. The authenticated donor remains the owner.

- **UC-015-AC01:** Company attribution requires a company name. A second account entering the same name gains no access to the first donor's donation, photos or booking.
- **UC-015-AC02:** Company food must be unopened, non-perishable and stored at room temperature. The flow provides no cold-chain exception, verification badge or tax-receipt action.
- **UC-015-AC03:** The company flow retains original AI indicators, human-only decisions and one atomic reception. Company attribution adds no shared company account or new privileged role.

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
| FEAT-003 | M | FR-005, FR-006 | BR-003, BR-008; NFR-001, NFR-004 | UC-002, UC-010, UC-012 |
| FEAT-004 | M | FR-007 | NFR-001, NFR-002, NFR-003, NFR-007 | UC-003 |
| FEAT-005 | M | FR-008, FR-009 | BR-001, BR-002, BR-004, BR-005, BR-007; NFR-002, NFR-006, NFR-008, NFR-009 | UC-004 |
| FEAT-006 | M | FR-010, FR-011, FR-018 | BR-001, BR-002; NFR-004, NFR-005 | UC-005, UC-008 |
| FEAT-007 | M | FR-013, FR-014 | BR-003, BR-006; NFR-001, NFR-004, NFR-006, NFR-009 | UC-006, UC-007 |
| FEAT-008 | M | FR-009, FR-012 | BR-001, BR-004, BR-005, BR-006; NFR-007 | UC-004, UC-006 |
| FEAT-009 | M | FR-015, FR-025 | BR-001, BR-006; NFR-001, NFR-004 | UC-007 |
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
| FEAT-022 | M | FR-033, FR-007, FR-023, FR-024 | BR-001, BR-005, BR-007, BR-008; NFR-001, NFR-004 | UC-015, UC-003, UC-010, UC-011 |

## Delivery priorities and forty-hour budget

Keep every M capability in its smallest usable form. Reuse one photo/detail view across donor, review and gallery; use a basic form/list rather than an advanced dashboard; keep light stock rather than a warehouse module. These are scope recommendations, not new UI requirements. All five category schemas remain in the baseline. The default provider is OpenAI; Jev and comparison are optional.

The following is an **illustrative planning allocation**, not evidence that the project is implemented or that these estimates are achievable. Hours are a total project effort budget, not per-developer allocations. No optional work is budgeted; stretch begins only if the required flow and checks finish early.

| Work package | Features | Proposed hours |
|---|---|---:|
| Frontend/backend scaffold, auth, roles, RLS and manual association approval | FEAT-001 and shared foundation | 5 |
| Needs form/free-text draft, capacity and hours/slots | FEAT-002, FEAT-003 | 4 |
| Uploads, five analysis schemas, indicators and corrections | FEAT-004, FEAT-005, FEAT-006, FEAT-008 | 6 |
| Geocoding, matching and offer/status flow | FEAT-007, FEAT-009 | 4 |
| Association human review | FEAT-010 | 3 |
| Booking and donor QR | FEAT-012 | 4 |
| Today's arrivals, QR reception and stock/distribution | FEAT-013, FEAT-014 | 4 |
| Expiry functions, buckets, FEFO and basic gallery/counts | FEAT-011, FEAT-015 | 3 |
| Automated checks, RLS/concurrency verification, photo set and demo | All M features | 5 |
| Resolve decisions, integration contingency and fixes | All M features | 2 |
| **Total** | **Required MVP only** | **40** |

Resolve the blocking ambiguities before implementing their dependent policies, especially auth/permissions, upload limits, bucket arithmetic, matching, units/capacity, transitions and QR exceptions. If estimates slip, simplify presentation and remove optional work in the exact AGENTS order: **Jev → provider comparison → expiry timeline → AI/human agreement metric**. Removing Jev also removes its dependent comparison. Do not cut indicators, expiry buckets/distribute-first, review queue, QR reception or auth/RLS. If the baseline still exceeds the budget, surface that constraint for a scope decision rather than calling an incomplete flow done.

Post-MVP contains advanced reporting/impact and discovery/verification/partnership work. External channels and logistics require a separate later authorization; their presence on the roadmap adds no requirement to the MVP.

## Acceptance and verification plan

| Check | Evidence needed at application delivery | Coverage |
|---|---|---|
| Expiry arithmetic | Deterministic unit tests with explicit reference dates: today, expired, unreadable, 7/30/90 boundaries, timezone/PAO policy once resolved | BR-002; FR-018–FR-020; UC-009 |
| Matching | Unit tests for full capacity, need/season eligibility, distance order and resolved ties/radius; same input gives same result without provider calls | BR-003; FR-013–FR-014; UC-006 |
| Analysis | Schema parsing checks and 25–35 local fixture photos including medicines/para; inspect indicators, unknown facts and warnings rather than approval outputs | BR-001/BR-004/BR-005; FR-007–FR-011; UC-003–UC-005 |
| Isolation and immutability | Two donors/two associations; direct read/write attempts across boundaries; original-result mutation rejected; secrets absent from client output | FR-001; NFR-001–NFR-005; UC-001/UC-003/UC-005/UC-008 |
| Lifecycle and concurrency | Staff-only decision, last-slot contention, duplicate/foreign QR and duplicate/excess distribution produce correct single effects | NFR-004; UC-007/UC-008/UC-010–UC-012 |
| Full flow | Own item → corrected facts → match → offer → staff review → booking/QR → staff reception → distribution, with in-app donor status and FEFO/gallery | All M features |
| Product language and exclusions | Every AI view uses indicator wording; human decision identified; no transport, routing, email or messaging paths | BR-001, BR-006 |
| Repository checks | Frontend pnpm lint/typecheck/test and backend Ruff/mypy/pytest pass once scaffolded; photo fixtures are present and exercised | NFR-009 |

These are acceptance specifications; the revised FastAPI architecture and enum schema remain documented designs, with no application, migration or dependency implementation. The current repository has no `package.json` or photo fixture set, so application commands and photo evaluation are future delivery gates. Documentation review checks that IDs are unique, all requirements are traceable, links resolve, priorities respect AGENTS.md and ambiguities remain explicit.
