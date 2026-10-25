# Dono requirements

Status: binding specification for a ≤40-hour MVP. Backend implementation and executed checks are recorded separately in [readiness](readiness.md); this document alone is not verification evidence.

## Authority and evidence

Read this document with the [feature specification and traceability matrix](features.md).

| Source | Use in this specification |
|---|---|
| [AGENTS.md](../AGENTS.md) | Authoritative product rules, security constraints, provider contract, priorities and verification gates. Overrides every other source. |
| [README.md](../README.md) | Product problem, categories, users, journeys, proposed features and roadmap. |
| [Architecture candidate](architecture/candidate.json) | Planned components, trust boundaries and responsibilities. |
| [Rendered architecture](architecture/dono-architecture.html) | Planned donor/dashboard/platform → FastAPI → analysis, geocoding and Supabase flows. |
| Architecture receipts in `docs/architecture/` | Existing generation/browser-check evidence for the diagram only; not evidence that the application exists or meets requirements. |
| Current domain review | Six structural corrections: reusable offers, independent budgets, finite reservations, separate lifecycles, secure memberships and delayed evidence/corrections. |
| [Domain model](domain-model.md) | Working DEC defaults under AGENTS authority; backend evidence in readiness.md. |

The updated architecture includes platform administration and geocoding as explicit components. [Database](databases.md) and [API](api.md) specifications refine that planned design; the [domain working defaults](domain-model.md#working-defaults) now resolve the six reviewed structural gaps on paper. Unrelated product ambiguities remain explicit below. Installed Supabase skill guidance informs the access-control and storage safeguards; it does not determine unresolved product permissions.

Requirement IDs are stable: `BR` = binding business rule, `FR` = functional requirement, `NFR` = non-functional requirement. `UC` and its acceptance criteria are defined in [features.md](features.md). `AMB` identifies a decision-register entry; each states whether it remains open or now has a working/resolved profile. Referenced IDs are not new definitions.

Priority: **M** = required MVP baseline; **S1–S4** = optional MVP stretch, cut in that order; **P** = post-MVP. **Derived** means a necessary safeguard or explicit documentation recommendation, rather than a behavior already specified in the sources. An open decision remains open even when its surrounding capability is M.

## Connected frontend — 2026-10-25

The current implementation removes runtime demo records and simulated commands. Supabase email/password authentication supplies the bearer identity; the frontend provisions a donor profile and reads association memberships only after a session exists. FastAPI owns all business data and transitions. Browser storage is used by the authentication SDK, not as a donation database.

Connected workflows use separate donation/offer/booking identities, three images total, server-computed balances and dates, full-lot receipt/distribution and signed QR retrieval. Public needs browsing is available without an account. Unmatched-post and company-attribution designs remain product/API gaps, with explicit unavailable states. Full-lot and expiry behavior follows the implemented backend contract; earlier demo-specific variants below are historical.

All collection views handle API pagination and empty/error states. Only current active association admins see configuration controls. Only human staff can submit decisions; original analysis remains evidence.

### Restored console and donor layouts — 2026-10-25, second pass

The connected frontend restores the chosen mockup structures within the API contract, with no demo records:

- Shared tables use the common DataTable with 10 rows per page by default; search and sorting run over the loaded result set before client pagination. My donations shows its search beside status filters (All, Drafts, Offered, Received, Withdrawn), sortable Item/Created/Status/Next-step columns, and per-row evidence with the staff decision, its timestamp, the staff note from offer events, actions and offer history.
- The association dashboard action cards carry client-counted numbers (waiting offers, drop-offs today, uncovered needs, expiring within 30 days) computed from loaded pages (`limit=100`, shown with `+` when more remain), a medicine-flag banner from the first loaded pending offers' evidence, and an active-needs progress panel separating received, reserved and still-needed quantities.
- Slots presents the month calendar with open/busy/full/closed day dots and a per-day panel listing that date's drop-offs and appointment times; admin slot and site forms remain. Capacity lists every category meter at once, with storage and daily intake as separate lists. Images shows the photo gallery grid with category and indicator filter chips plus expiry-bucket and FEFO side panels. Admin approvals use the verification table with a details column and manual-verification confirmation.
- Donor matching shows "N associations need this" with the item/expiry subtitle, a "Why these associations?" panel from the returned match budgets, and the no-match state lists redirect points from `GET /redirect-points` (FR-012) with a "Scan another item" continuation. The review queue shows each offer's age, and the review evidence panel highlights a donor-corrected printed date against the AI-detected date. Reception heads the day's list with its expected count.
- Counts and ages are computed in frontend code from API results; the API has no aggregate endpoint, so totals cover the loaded pages and say so.

### Item camera capture

Signed-in donors can take an item photo or label close-up from the photo step. The camera screen prefers the rear camera, shows a live preview, and lets the donor capture, retake or use a photo. Using a photo adds it to the same local selection as a file upload. It does not upload or start analysis by itself. Existing file selection, replacement and removal remain available.

Camera access requests video only. Closing the screen or reviewing a capture stops the camera, including when a permission request finishes after closure. Permission denial, a missing camera or an unsupported browser leaves a file-selection fallback. Live camera access requires HTTPS or localhost. Captured JPEG files follow the existing three-photo total and 4 MiB per-photo limits, including already saved photos.

## Public needs and account boundary

Visitors can browse and inspect active, in-season needs from approved associations without signing up. The directory shows only public need criteria, target and remaining quantities, and association name and drop-off address. Remaining demand excludes received items and live reservations. It does not promise that a particular item can be accepted or that a drop-off slot is available.

Town or postcode is optional. A blank search lists all eligible needs in the selected category without a distance. A town search returns associations with the canonical town name resolved by BAN. A full five-digit postcode search returns associations in that postcode. Apply the location and category filters before pagination, then order matching results by straight-line distance. This public-directory rule replaces distance-only searching; authenticated item matching still uses its existing distance-ranking rules. Nonblank searches must contain 3–200 characters after trimming and start with a letter or number. Invalid input shows a correction message, not a service-outage message. The form suggests a town or full postcode, such as `Mulhouse` or `68100`. Failed geocoding shows an error, never invented coordinates. Search and category changes reset pagination and item selection. The list loads ten needs at a time.

Choosing **Offer an item** requires signup or sign-in before donation preparation and photo upload. Keep the selected need, category and search location through authentication. Recheck the selected need through authenticated matching before sending an offer. Staff retain the decision; browsing and signup reserve nothing.

## Historical demo decisions — 2026-10-25

The former frontend implementation was a browser-local demo, separate from the backend. These notes record the earlier design and do not describe the current runtime. The user's latest frontend requests override earlier mockup controls and the FEFO presentation requirement for this demo. The second 2026-10-25 restoration made the shared-table, My-donations-filters, dashboard-KPI and capacity-threshold decisions below current UI again, implemented against the real API; the remaining notes stay historical:

- Shared tables show 10 rows per page by default. Search and sorting use the full result set before pagination and reset the page. Single-row selection survives page changes. My donations places search beside its status filters, with wrapping on narrow screens. Nearby needs shows up to 10 sample needs per page.
- Location on Nearby needs is optional. Empty or whitespace-only input shows all samples within the selected category. Nonempty input retains the samples and explains the absence of distance filtering. Search and category changes reset pagination and item selection. Helper text does not shift the Location field, Search button or filters.
- Card actions use a shared footer at the bottom. Sibling gallery cards align their buttons despite different content lengths. User-facing terms use Posted offers, Photograph an item, Drop-off location, Waiting for review and Given out. Readable indicator labels replace raw keys. Stored values and API fields remain unchanged.
- The association dashboard replaces unavailable urgency/expiry cards with four action KPIs: waiting offers, expected drop-offs today, active needs still uncovered, and categories above 85% capacity. Capacity uses stock plus approved/booked reservations, with zero limits paused. Need progress separates actual received quantities, reservations and the remaining gap. Stock, needs, capacity, matching and the dashboard share association-scoped balances with three-decimal quantity precision.
- Dashboard activity uses actual receipt and distribution movements, scoped to the association. This week starts Monday at 00:00 in Europe/Paris and ends at the current instant. Reception refusals show a count and staff reasons, without a rate. Missing offer times do not use draft creation times. Expiry, urgency, no-show, environmental and beneficiary metrics remain excluded.
- Photograph an item supports several views of the same item, with an optional separate label close-up. The demo allows six item photos plus one label, with JPEG/PNG/WebP validation and a 5 MB limit per file. The implemented backend permits three photos per donation; local preview behavior does not change that limit.
- Association pages omit duplicate Category dropdowns under More filters and FEFO/distribute-first controls and panels. Main category controls, source dates, indicators and normal stock distribution remain available.
- Capacity displays show the computed percentage of stock plus reservations against the limit. The display is green through 60%, orange above 60% through 85%, and red above 85%. A zero limit remains a neutral paused state. Each capacity meter shows 60% and 85% threshold markers. Shared precise calculations drive the meter color and near-capacity KPI. Selected table rows use a visible semantic background and an aligned checkmark.
- Required fields show red styling and a nearby error after interaction or a failed submission. Registration still accepts RNA alone, SIRET alone, or both. A supplied SIRET must pass local format and checksum validation; this does not verify registry existence or grant approval. Step navigation sits in a separate action area below the content.
- Platform approval uses the selected association for the row highlight, details and approval action. Clearing selection or changing status filters removes the target. Registration lets visitors choose a donor demo persona at Review while keeping their entered fields on the page. Company drafts require a product description with non-space characters before continuing to photos.
- Failed browser storage writes retain current session state and show a persistent warning with Retry saving. Recovery saves the latest full session without repeating actions. A startup read failure protects the unread browser copy from ordinary writes; explicit retry replaces it, as explained in the warning. Offer and registration confirmations distinguish session-only changes from saved changes.
- When a valid analyzed draft has no eligible association match, its donor can choose Post offer. The item appears as Posted in My donations and as Available in the association's Posted offers view. Only explicitly posted items appear there. Donor identity and private location stay out of the listing. Medicine and chilled-food warnings still prevent posting. Posting assigns no association or need and creates no staff decision, reservation, booking, QR or stock movement. The donor can withdraw the post and edit the preserved draft. Claiming remains undefined and unavailable.
- Open demo tabs on the same browser origin receive saved posts and withdrawals without reloading. Each tab retains its selected role. An action refreshes saved data before applying its command, so a stale tab cannot erase an earlier saved post. Unsaved local changes remain intact if another tab changes the browser copy; replacement requires the explicit retry described in the storage warning. This demo does not synchronize across browsers or devices, or guarantee atomic simultaneous writes.
- Staff can refuse a booked donation before receipt. A required reason and explicit confirmation record the human decision. The donation becomes terminally refused; offered quantity, original AI evidence, original approval attribution and booking history remain. No receipt or stock movement is created. The demo releases the provisional need/capacity hold and slot allocation. Donors see the reason; a refused booking cannot show an active QR, be received or be rebooked.

Reception refusal and unmatched-offer posting were demo-only extensions with no corresponding backend operations. Backend reservation, cancellation and no-show behavior is defined in [domain-model.md](domain-model.md). The connected frontend uses that contract; the unsupported product extensions remain open.

## Backend integration differences

These differences describe the replaced demo and the API baseline. The connected implementation uses the API baseline where supported; unsupported product behaviors remain open and are not simulated.

| Area | Historical demo | Current API integration |
|---|---|---|
| Identity and persistence | Demo personas and browser-local state. | Supabase bearer identity, profile bootstrap and membership checks through an authenticated API client. |
| Item and offer identity | `Donation` combines item facts, recipient and decision/status. | Separate reusable donation, recipient offer, booking and inventory lifecycles with explicit DTOs and actions. |
| Photos | Six local item views plus one label. | Three uploaded images total, 4 MiB each and 20 megapixels; authenticated content routes and private base64 persistence. |
| Reception and stock | Quantity correction at receipt and partial distribution. | Connected actions require full-lot reception and distribution. Partial-quantity behavior remains unsupported. |
| Posting and reception refusal | Explicit unmatched posts and terminal refusal before receipt. | No matching publication or reception-refusal endpoint. Do not map either to unrelated commands. |
| Company attribution | Existing donor acts for a named company; no shared company account. | Closed donation DTOs have no `donor_kind` or `company_name`. Preserve AMB-022 as an integration gap. |
| Need criteria | Freeze category, unit, attributes and seasons after commitments/receipts. | The connected editor follows backend validation and preserves frozen prior offers. The stricter historical policy in AMB-024 remains a product gap. |
| Packaged goods and PAO | Unopened food/para; PAO is label evidence only. | The connected form represents backend opening facts and PAO constraints. The stricter historical packaged-goods policy remains a product gap. |
| Expiry presentation | FEFO panels removed for the demo. | Connected stock views use server-computed expiry buckets and FEFO ordering required by the backend baseline. |

One donation still represents a single homogeneous product lot. Neither branch's tests establish the connected donor-to-staff journey.

## Product scope

The six-issue domain correction uses [explicit working defaults](domain-model.md#working-defaults), not indefinite deferral of offer/reservation/permission mechanisms. Numeric durations are proposals for this MVP, changeable through a consistent design revision. Original BR IDs and optional cut order are preserved.

Dono helps individuals offer usable in-kind items to associations that need them and have capacity. It gives staff photos, AI indicators and date information to support their own decision. An approved offer leads to a donor-arranged drop-off booking, QR reception and a light stock record.

The MVP supports clothes, shoes, non-perishable room-temperature food, parapharmacy/hygiene and small furniture brought by the donor. Medicines are excluded. A para category is not proof that an item is not a medicine.

The required vertical slice is: authentication and association approval → needs/storage/dated intake quotas/slots → photo analysis and corrections → matching and offer → staff review → booking/QR → reception, stock and distribution → expiry buckets and distribute-first list. All donation status is visible inside the application.

Transport, pickups, vehicle routing, delivery assignment, donation notification emails and messaging channels are outside the MVP. Supabase account confirmation emails are allowed when enabled. A straight-line distance used for matching is not a travel route. A drop-off appointment is not a transport service. Recipients of redistributed goods are beneficiaries, not MVP application users.

Success is demonstrated by completing this flow with isolated donor and association accounts while preserving human decisions, original indicators and deterministic calculations. No conversion, accuracy, latency, kilograms or financial targets are specified by the sources.

## Personas, actors and permissions

| Persona / actor | Need and permitted responsibility |
|---|---|
| Public visitor | Browse public needs and association drop-off details; sign up or sign in to offer an item. No private records or commands. |
| Individual donor (`donor`) | Photograph an item, understand indicators, correct facts/category, find a suitable association, offer, follow status and book their own drop-off. |
| Association coordinator (`assoc_admin`) | Prepare the association's needs, capacity and slots; review donations and oversee reception and stock. |
| Association volunteer (`assoc_staff`) | Review offers, receive booked donations and record distribution for an association to which they belong. Configuration and membership management are reserved to assoc_admin (DEC-010). |
| Platform operator (`platform_admin`) | Manually approve associations registered with RNA/SIRET. Limited orphan-admin recovery may reactivate only the original applicant under DEC-010; no donation visibility. |
| Analysis service / OpenAI | Extract label facts and return category-specific indicators and confidence. It has no decision authority. |
| Optional TypeSafe Jev | Supply probability indicators only, when enabled. It cannot provide OCR, dates or numeric extraction. |
| Deterministic application services | Compute expiry, matching, distance and operational totals; enforce authorization and transitions. They do not decide item usability on staff's behalf. |
| Supabase Auth and Postgres | Authenticate users and persist scoped records, photo metadata and private base64 payloads. These are supporting systems, not staff roles. |
| Government BAN via IGN | Geocode addresses for deterministic distance calculations; no routing. |
| Pharmacy / textile bin / repair café | External redirection destinations. No account, reservation or message is sent to them. |

The working permission profile resolves the earlier TBD entries. Every association action also requires enabled profile, active membership and approved association; original evidence is never writable.

| Action / data | Donor | Assoc. admin | Assoc. staff | Platform admin |
|---|---|---|---|---|
| Current item facts / source dates | Own; edit without effective active offer, before transfer | Offered snapshot only | Offered snapshot only | No general read |
| Original evidence | Own history | Explicit evidence scope on own association offers | Same | No general read |
| Create/withdraw/re-offer / cancel own booking | Own; preserve history | No owner impersonation | No owner impersonation | No |
| Human offer decision / approved-attempt cancellation | No | Target association | Target association | Only with a separate valid personnel membership |
| Configure needs/storage/quotas/hours/slots | No | Own association only | No | No |
| Receive QR / distribute full stock | No | Target association | Target association | No platform-derived permission |
| Register association | Authenticated applicant; atomic inactive initial admin | Same account capability | Same | Manual approval |
| Activate initial applicant admin | No | No | No | Atomic platform approval only |
| Read member roster; grant/change/revoke/transfer | Own membership/status only | Own association; last-admin invariant | Own membership only | No general management |
| Orphan-admin recovery | No | No active admin exists | No | Original registered applicant only, manual verification/reason/audit |

## Binding business rules

| ID | Priority | Rule and verification intent | Source |
|---|---|---|---|
| BR-001 | M | AI returns indicators, extracted facts and confidence only. Only authorized association personnel set donation `decision`. AI cards never claim “Accepted” or “Refused”; human decision status is explicitly attributed to staff. | AGENTS §1 |
| BR-002 | M | Code computes all derived dates and numbers, including days left, expired flag, buckets, FEFO, counts and distances. Compute expiry derivatives at read time; do not store them. OpenAI may extract visible dates, numeric facts and PAO months; model-supplied probabilities/confidence are estimates, not operational arithmetic. | AGENTS §2 and provider contract |
| BR-003 | M | Match with deterministic need + capacity + season + Haversine distance. No model call, LLM ranking or model-authored explanation is part of the matching path. | AGENTS §3 |
| BR-004 | M | Medicines cannot be donated. A high medicine indicator produces a warning and pharmacy redirection, never a model-issued refusal. Confirmed medicines cannot proceed through a staff approval override. Uncertain-item handling follows analysis-v1 (AMB-007 working default). | AGENTS §4 |
| BR-005 | M | Individual food donations are limited to non-perishable products stored at room temperature. Chilled/frozen items show a warning indicator and are outside eligible food scope; precise clarification/acknowledgement handling follows analysis-v1. | AGENTS §5 |
| BR-006 | M | No transport, pickups, vehicle routing, donation notification emails, chat, Telegram or other messaging channel is part of the MVP. Donation status and appointment information stay in the app. Supabase account confirmation emails are allowed when enabled. | AGENTS §6; current request |

## Functional requirements

### Identity, access and association setup

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-001 | M | Provide Supabase email/password signup and sign-in; signup requires at least eight password characters. Wait for an authenticated session before profile bootstrap, including when email confirmation is required. Authenticate verified Supabase subjects and enforce donor ownership, active enabled membership and protected platform capability. No self-editable role claims. Raw current donation facts are owner-only; association reads are scoped to their offer snapshots/evidence. Enforce the same boundaries in RLS and privileged command guards. | Current request; AGENTS; derived security safeguard |
| FR-002 | M | Register a pending association with the verified applicant and an inactive initial-admin membership atomically. Manual platform approval activates that exact applicant admin in the same transaction. Validate/normalize RNA/SIRET syntax and uniqueness under the one-site MVP profile; pending associations receive no offers. | README; derived approval gate |
| FR-003 | M | Maintain confirmed item demand, category/attribute criteria, explicit season rules and a staff-declared storage cost per item. Requested item quantities are distinct from storage places and dated intake quotas (DEC-004/009). | README; AGENTS matching rule |
| FR-004 | M | Accept free-text needs and return an editable AI-structured draft for staff confirmation before saving. Parse stated quantities; do not invent or calculate them with AI. The form remains available if parsing fails. | README; derived confirmation safeguard |
| FR-005 | M | Maintain physical category storage ceilings in item_slot units. Count approved live storage holds plus actual undistributed stock; reject overcommitment. Dated intake quotas and requested demand are independently configured/evaluated (FR-034). | README; derived consistency safeguard |
| FR-006 | M | Maintain association-local hours, non-overlapping same-day slots and appointment-place limits. Require usable intake address/timezone; freeze existing booking context and reject destructive edits per DEC-012. | README |

### Capture, analysis and correction

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-007 | M | Capture/upload item photos and a readable label close-up for food/para; validate file type and size before sending any file to a provider. README specifies 1–2 photos plus a close-up; total attachment cap remains AMB-003. Persist validated images as base64 text in private.photo_contents with metadata in donation_photos, atomically; no Supabase Storage. | AGENTS security; README |
| FR-008 | M | Provide five closed category extraction/indicator contracts under analysis-v1, finite category confidence/probabilities, explicit nulls and Python validation. Preserve valid uncertain originals; invalid/failed/refused provider output is unavailable, never a donation decision. Complete human facts remain a manual fallback. | AGENTS; derived failure behavior |
| FR-009 | M | Display attributable original indicators with Python-defined low (<0.50), medium (0.50–<0.80) and high (≥0.80) bands. Null is unassessable, not low/zero. confidence is the selected category estimate, not suitability/OCR certainty. Retain medicine/pharmacy and cold-food warnings across category edits. | AGENTS; README |
| FR-010 | M | Allow owner category/attribute/source-date edits when no active offer exists and the item is not transferred. Track facts_revision and human origin separately from original evidence. Withdrawal/cancellation permits correction and a new offer. Active offers freeze their own facts/photos; no silent review invalidation. | Current request; README |
| FR-011 | M | Preserve original category/extraction/indicators/probabilities/confidence/provider/model/photo context immutably. New analyses append history; category changes show mismatch and never erase known medicine concerns. A missing comparison basis attaches independently from seeding and never becomes a permanent submission gate. | Current request; derived provenance safeguard |
| FR-012 | M | Make “Other options” available using redirect points such as pharmacies, textile bins and repair cafés, including when no suitable association is found. No booking or communication with these destinations is required. | README; AGENTS medicine rule |

### Matching, offers and human review

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-013 | M | Geocode request-scoped donor location through the selected government BAN/Géoplateforme service; compute Haversine distance in code. Do not invent coordinates on failure. Distance ranks eligible candidates; there is no MVP radius gate or retained donor-origin field (DEC-009; AMB-021 service selected). | AGENTS; README; derived failure behavior |
| FR-014 | M | Deterministically evaluate demand/category/attributes/current season, independent physical storage, and at least one future slot with sufficient dated intake quota and appointment space. Order by Haversine distance, association ID, need ID. Recheck current constraints on offer/approval/booking; no model in this path. | AGENTS; README; derived stale-data safeguard |
| FR-015 | M | Create a donation_offers attempt distinct from the reusable donation. Keep all attempts and decisions. At most one pending_review/approved attempt exists; refusal/withdrawal/cancellation/expiry permits a new attempt on the same unreceived item. My donations composes item, offer, booking and inventory status instead of persisting one combined enum. | README |
| FR-016 | M | Show target personnel the frozen offer facts, scoped original evidence/indicators or explicit unavailability, corrections/mismatch and read-time expiry. Keep previous associations out of future edits/attempts; retain their own historical snapshot and allowed evidence only. | README; current request |
| FR-017 | M | Only current target personnel approve/refuse with actor/time/reason. Apply analysis-v1 manual-review and safety-clarification assertions plus expiry-v1 date guards/acknowledgements, independently of capacity checks. No model decision, strict-date override or later decision rewrite. | AGENTS; derived actor attribution |

### Expiry and inventory

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-018 | M | Retain source date/type/printed PAO/raw label/precision/readability and human opened_on separately from immutable originals. Apply expiry-v1 exact/partial/ambiguous-date and opening-state validation without inferring missing source facts. | AGENTS; README |
| FR-019 | M | Python computes effective expiry, calendar days/expired and one exclusive expiry-v1 bucket at read time: expired, today, lt_7, lt_30, lt_90, at_90, gt_90, unknown or not_applicable. Today is valid (0 days); exact 7/30/90 map to lt_30/lt_90/at_90. No stored derivatives/model arithmetic. | AGENTS |
| FR-020 | M | Use expiry-v1 deterministic FEFO on actual received-undistributed lots: dated/date/receipt-time/UUID, then unknown FIFO, not-applicable FIFO, and separate blocked lots. Distinguish DLC/para strict restrictions from DDM quality warnings; counts use one bucket per lot. | AGENTS; README; derived inventory boundary |
| FR-021 | M | Provide an association image gallery with indicator overlays and basic category/indicator/expiry filters, expiry counts and a distribute-first list. Counts respect the selected scope and avoid double counting; detailed metric definitions remain AMB-014. | README; AGENTS protected expiry scope |
| FR-022 | M | Record exactly one actual full receipt and at most one full distribution per donation across all offers. Receipt atomically fulfils the offer, receives the booking and transfers the item. Distribution frees storage without reopening fulfilled demand/consumed daily intake. No partial lots or reversals in the MVP working profile. | README; derived consistency safeguards |

### Booking and reception

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-023 | M | Book the owner’s live staff-approved offer before its 24-hour booking deadline, into a future slot within seven days with both quota and appointment space. One booking per attempt, many historical bookings per item across attempts. Retrieve signed QR in-app; cancellation ends that attempt and requires new review before rebooking. | README; derived concurrency safeguard |
| FR-024 | M | Authenticated target personnel resolve the signed QR read-only, then explicitly receive once within [slot start, slot end + 30 minutes). Verify current nonce, scope, live offer/booking/item and full lot. Cancelled/expired/no-show/foreign/repeated QR cannot create stock; typed signed payload is the camera-failure fallback. | README; derived authorization/idempotency safeguards |
| FR-025 | M | Show association-local arrivals and effective appointment state; reflect all donor-owned attempt/booking/reception outcomes in-app. Include elapsed deadlines even before reconciliation persists their terminal states. No outbound notification. | README; AGENTS no-channel rule |

### Corrected domain safeguards

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-033 | M | Persist reusable donations separately from historical donation_offers, with at most one pending_review/approved row per item. Materialize due active attempts under locks before replacement. Same item ID survives refusal, withdrawal and re-offering. | Domain review 1/4; DEC-001 |
| FR-034 | M | Configure and independently check requested demand, physical storage, dated intake quotas and appointment places. Matching requires a feasible future slot/quota; approval holds demand/storage and booking adds quota/place. | Domain review 2; DEC-004/005 |
| FR-035 | M | Use finite 72-hour review, 24-hour approval-to-booking, seven-day booking horizon and end+30-minute receipt deadlines. Withdrawal/cancellation/expiry/no-show releases all unreceived holds exactly once; ignore elapsed holds on reads before cleanup. | Domain review 3; DEC-002/003/005 |
| FR-036 | M | Keep separate item, offer, booking and derived inventory states with audited transitions. Preserve prior decision and snapshots after cancellation; allow recovery by a new offer/booking until physical transfer. No partial lots/reversal in MVP. | Domain review 4; DEC-001/005/012 |
| FR-037 | M | Define trusted profile creation, pending initial-admin bootstrap, atomic platform activation, admin-only member grants/role changes/revocation/transfer, last-enabled-admin protection and constrained orphan recovery. Current database permissions override stale JWT claims. | Domain review 5; DEC-008/010/011 |
| FR-038 | M | Separate AI evidence attachment from working-fact seeding, use captured facts revisions/human origin, preserve all originals and late-response provenance, and allow acknowledged manual review of complete validated human facts when analysis is pending/unavailable. | Domain review 6; DEC-006/007 |
| FR-039 | M | Allow unauthenticated browsing of a limited public needs directory, optional town/postcode search and category filtering. Require an authenticated application account to prepare or send an offer. Preserve selected need intent through authentication and revalidate it through matching; never grant public access to private association, donor or evidence records. | Current user request, 2026-10-25 |

### Optional and post-MVP requirements

The order S1 → S2 → S3 → S4 is the mandated order for removing optional work. None may delay the M baseline.

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-026 | S1 | Add Jev probability indicators and hybrid mode behind `ANALYSIS_PROVIDER`. Jev never performs OCR/date/number extraction; hybrid uses OpenAI for that. Image requests require `TypeSafe-Danger-Zone-Images: true`. Standalone Jev extraction/category sourcing remains AMB-018. | AGENTS |
| FR-027 | S2 | Compare OpenAI/Jev indicators from attributable, separately retained results without producing a decision or claiming either provider is ground truth. Requires FR-026 and a defined comparison set. | AGENTS cut list; README |
| FR-028 | S3 | Add a code-computed expiry timeline using the same date scope/rules as the expiry list, without persisting derived expiry values. | AGENTS cut list; README |
| FR-029 | S4 | Add AI-vs-human agreement reporting only after a valid label and denominator definition is agreed. A staff approval/refusal must not be treated automatically as a ground-truth indicator label. | AGENTS cut list; derived measurement safeguard |
| FR-030 | P | Add advanced expiry metrics such as average shelf life and a broader impact dashboard (matched donations, approval rate, kg diverted, estimated disposal costs avoided, expired items stopped before drop-off). Formulas, measured weights, baselines and event definitions must first be agreed; all arithmetic stays in code. | README; proposed deferral for 40-hour limit |
| FR-031 | P | Consider automatic RNA/SIRET checks, a visual map and formal redirection partnerships. These are roadmap candidates, not commitments for this MVP. | README roadmap |
| FR-032 | P | Consider external notification channels, needs by email, urgent alerts, transfers/pickup logistics and routing only in a separately authorized later scope. No supporting channel or transport integration is required in the MVP. | README roadmap; current request |

Analysis and expiry contracts are [analysis-v1](analysis-rules.md) and [expiry-v1](expiry-rules.md), with [future test fixtures](rules-test-cases.md). These proposed defaults resolve the two remaining review blockers without changing architecture or states.

## Analysis and data responsibilities

| Category | Extracted / observed information to support | Indicator examples |
|---|---|---|
| `clothes` | Garment type, size, season | Wear, stains, holes, pilling |
| `shoes` | Shoe type and size | Complete pair, sole wear, upper damage |
| `food` | Product, printed date and DLC/DDM type | Packaging damage, swollen can, chilled/frozen concern |
| `para` | Product, printed expiry, PAO months | Seal, medicine resemblance |
| `furniture` | Item type, size class | Condition, visible damage |

These source-backed summaries are refined by the exhaustive analysis-v1 fields/indicator keys in analysis-rules.md; AMB-017 now has a working contract. Days left belongs to code-computed display, never model extraction; the pre-review README grouped it with indicators, and the reviewed README separates those responsibilities. Unknown dates and unobserved seals must not be represented as certain facts.

Data concepts follow the existing plan, without defining SQL or adding a schema:

| Planned entity / concept | Required responsibility |
|---|---|
| `profiles`, `associations`, `association_members` | Identity, association approval and membership-scoped permissions; approval is separate from donation decisions. |
| `needs`, `capacity`, `intake_quotas` | Independent demand, physical storage and dated intake budgets. |
| `donations`, `donation_offers`, `offer_events` | Reusable current item facts, separate targeted attempt snapshots/human decisions and immutable attempt history. |
| `donation_analysis`, `donation_indicators` | Original provider/model/category/facts/confidence and indicators; immutable through application edits. |
| Human correction record / representation | Separate working corrections and actor provenance; physical representation is not decided here. |
| `expiry_info` | Source date/type/PAO facts and corrections only; never days left, expired flags, buckets or FEFO ranks. |
| `slots`, `bookings` | Association appointments and approved-offer bookings with finite QR/receipt validity and preserved terminal outcomes. |
| `inventory_movements` | Actual received/distributed quantities; pending offers are not received stock. |
| `redirect_points`, `donation_photos`, `private.photo_contents` | Alternative destinations; photo metadata and separately protected base64 content. |

Original AI indicators survive edits/decisions. The first successful run can be the comparison basis even if facts were already edited; only an untouched empty set may be seeded. New analysis after submission requires withdrawal first; existing in-flight requests remain scoped to the offered evidence. Mandatory same-category reanalysis is not an MVP gate; mismatch and unavailable evidence are explicit under DEC-006/007.

## Non-functional requirements

| ID | Priority | Requirement and observable verification | Basis |
|---|---|---|---|
| NFR-001 | M | Enforce current membership and donor ownership in RLS and every backend command. Keep current donation/expiry facts donor-only; staff read their offer snapshot and explicit photo/analysis-request/edit scope. Test A→B re-offer privacy, direct Data API/RPC/private-photo access and revoked-token/retry denial. | AGENTS; derived least-access boundary; Supabase skill |
| NFR-002 | M | Keep `OPENAI_API_KEY`, `TYPESAFE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only and out of client bundles/logs. Never commit `.env*` except `.env.example`. Privileged server paths must recheck actor authorization and cannot silently bypass product isolation. | AGENTS; Supabase skill |
| NFR-003 | M | Validate uploads by allowed type and configured size, reject malformed files before analysis, and scope photo reads to owner/authorized receiving association. Check decoded bytes and encoded base64 length, keep payloads out of list/audit/retry JSON, and authorize private content access. Exact upload formats/limits and retention remain AMB-003/AMB-015. | AGENTS; derived storage safeguard |
| NFR-004 | M | Use locked atomic commands, idempotency, scoped FKs and stored-state unique constraints. Concurrent last-demand/storage/quota/slot claims, cancellation/receipt/expiry, re-offering and duplicate stock events cannot oversubscribe or repeat effects. Deadline-aware reads free expired holds without relying on a scheduler. | Derived integrity safeguard |
| NFR-005 | M | Preserve original evidence, human corrections, offer decisions, item disposition, membership and booking history with attribution. Frozen offer evidence scopes exclude future donor facts. Stale screens do not overwrite state; late AI only appends evidence and optionally seeds an untouched empty working set. | Current request; derived integrity safeguard |
| NFR-006 | M | Handle analysis/geocoding failures with an understandable in-app error and retry path. Preserve known facts and avoid fabricated indicators, distances or success states. A failed AI call never becomes a refusal or approval. Numeric timeout/latency targets remain AMB-019. | Derived reliability safeguard |
| NFR-007 | M | Support the donor flow in a mobile browser and staff review/reception in a browser, with readable uncertainty, labeled inputs and warnings/status understandable without color alone. Offline operation and installability are not established by the “PWA” architecture label. | README/architecture; derived usability baseline |
| NFR-008 | M | Use one provider-independent contract and category-schema validation, with OpenAI as the required provider. Calculations remain independently testable using an explicit reference date/input set; provider selection never changes human decision authority. | AGENTS |
| NFR-009 | M | Before application delivery, pass the planned frontend lint/typecheck/tests and backend Ruff/mypy/pytest checks; test expiry today/expired/unreadable and resolved bucket edges, matching full capacity/season/distance, plus analysis parsing and the 25–35-photo fixture set including medicines/para. Verify no UI path attributes a decision to AI. The application and fixtures are not present at this documentation baseline. | AGENTS verification; derived resolved-edge coverage |
| NFR-010 | M | Keep implementation within ≤40 hours and the Next.js/TypeScript/Tailwind/shadcn frontend, Python FastAPI backend, Supabase, OpenAI and government BAN geocoding architecture. Check package versions before adding dependencies. Preserve protected scope and remove optional work in the AGENTS cut order. | AGENTS; README |

## Ambiguities and decisions required

Entries marked working profile are now concretely defined by the proposed DEC defaults; other questions remain unresolved. No default is hidden. The “needed before” column identifies dependent work; unrelated implementation need not wait. The suggested decision owner is a documentation recommendation, not an assigned project role. No ambiguity permits violating BR-001–BR-006.

| ID | Open question / source gap | Needed before | Suggested owner |
|---|---|---|---|
| AMB-001 | **Working profile defined by DEC-010:** admins configure/manage membership; staff review/receive/distribute; last-admin protection, transfer, revocation and constrained original-applicant recovery are specified. Broader platform powers and invitations are outside MVP. | Implement/verify working profile; review later extensions | Product owner |
| AMB-002 | **Working onboarding defined by DEC-008/010/011:** email/password authentication, trusted donor-profile provisioning, at least one syntactically valid unique RNA/SIRET, pending inactive applicant admin, atomic manual platform approval/activation. Hosted Email settings, optional confirmation delivery and migration setup remain deployment work. Registration rejection/resubmission UI and multi-site support are deferred. | Verify hosted signup and profile; review later extensions | Product + technical owner |
| AMB-003 | Does “1–2 photos + label close-up” mean two or three total? Which MIME types, byte limits, dimensions and replacement behavior are supported? | Upload configuration | Technical owner |
| AMB-004 | **Working correction/reanalysis policy defined by DEC-006/007:** edit only with no active offer before transfer; freeze attempt snapshots; attach missing basis independently from seeding; no mandatory same-category reanalysis; acknowledged manual fallback. In-flight results never replace human facts. Post-receipt stock-fact correction/returns remain outside MVP. | Implement/verify working profile; review later extensions | Product owner |
| AMB-005 | **Working default expiry-v1:** exclusive buckets including today and exactly 90; local calendar days, nullable unknown/NA and single-count metrics. See expiry-rules.md and EX-T001–010/028–029. | Implement/verify the versioned defaults; review later extensions | Product owner with association staff |
| AMB-006 | **Working default expiry-v1:** source parser, DDM month/year bounds, strict-date uncertainty, human opening state/date, calendar-month PAO, combined minimum constraints and total FEFO order. No invented opening/year/century. See expiry-rules.md. | Implement/verify the versioned defaults; review later extensions | Product + technical owner |
| AMB-007 | **Working defaults analysis-v1 / expiry-v1:** medium at 0.50, high at 0.80; pharmacy warning, explicit human clarification/acknowledgements; confirmed medicine/cold food excluded. Passed/unresolved strict dates block physical commands without setting decision; DDM has separate human review. | Implement/verify the versioned defaults; review later extensions | Product owner with association staff |
| AMB-008 | **Working accounting defined by DEC-004/005:** integral item demand/intake, separate item_slot storage and staff rate, approval-time need/storage holds, booking-time quota/place holds, exact release/conversion rules. Kg/volume/partial lots remain post-MVP. | Implement/verify working profile; review later extensions | Product owner with association staff |
| AMB-009 | **Working matching defined by DEC-009:** explicit calendar seasons, unrestricted empty need.seasons, nearest-first stable IDs, no radius/weights, unknown required attributes/location excluded with reason. Future scoring/radius changes require source/privacy review. | Implement/verify working profile; review later extensions | Product owner |
| AMB-010 | **Working slots/recovery defined by DEC-003/012:** no active overlaps, same-local-day intervals, configured hours, finite horizon/grace, cancellation ends attempt, fresh review for rebooking. Freeze booked context/timezone rule; no automated reschedule or partial delivery. | Implement/verify working profile; review later extensions | Product owner |
| AMB-011 | **Operational reference defined by DEC-009:** association IANA zone, Europe/Paris demo default and UTC deadline instants; frozen once slots exist. Shelf-life semantics now use expiry-v1; explicit offset/DST tests remain required. | Implement/verify working profile; review later extensions | Product + technical owner |
| AMB-012 | **Working attempt lifecycle defined by DEC-001/002/005:** one active offer, preserved refused/cancelled/expired history, owner withdrawal/re-offer/restore, staff cancellation with reason, no reversal of prior human decision. Physical receipt is terminal for donor re-offering. | Implement/verify working profile; review later extensions | Product owner |
| AMB-013 | **Working QR/reception defined by DEC-003:** signed booking/nonce/cutoff, state-based invalidation, receipt only in [start,end+30min), typed signed payload fallback, no partial/mismatch receipt. Cancel an unreceived mismatch and re-offer after correction; no late/early override. | Implement/verify working profile; review later extensions | Product + technical owner |
| AMB-014 | Which dashboard items are in stock vs offered/approved? What defines an unreadable-date count, average shelf life, match, diverted kg, avoided cost or “expired item stopped”? No formulas or empirical factors are supplied. | Metrics implementation | Product owner |
| AMB-015 | Photo/fact retention, account deletion, analysis deletion and privacy notice content are unspecified. “Immutable” means no silent edit to AI evidence, not a decision to retain personal data forever. | Retention policy and release | Product owner |
| AMB-016 | **Working disclosure/ranking boundary defined by DEC-009/012:** donor origin request-scoped, no radius gate, limited association name/address projection and booked address snapshot; unavailable geocoding fails explicitly. Retention/privacy notice remains AMB-015. | Implement/verify working profile; review later extensions | Product owner |
| AMB-017 | **Five closed contracts defined in analysis-rules.md:** categories, allowed attributes/indicator keys, finite category probability distribution, nulls, thresholds/conflicts, provider failure and manual fallback. No sixth category, implicit confidence or unversioned schema. Provider/model smoke tests remain implementation work. | Implement/verify the versioned defaults; review later extensions | Product + technical owner |
| AMB-018 | Jev-only results cannot supply OCR/facts or the required category by extraction. What supplies those contract fields, and is image support usable? Optional modes must remain disabled until resolved. | S1 provider work | Technical owner |
| AMB-019 | No supported device matrix, accessibility conformance target, model/cost budget, response-time target or uptime target is specified. Do not invent an SLA or accuracy claim. | Performance planning / deployment | Product + technical owner |
| AMB-020 | The pre-review README labeled advanced metrics and formal impact reporting MVP. The reviewed README now aligns with proposed post-MVP deferral (FR-030); confirm if a simple measured counter must instead be included. This wording alignment does not resolve the product choice. No estimated factors are authorized. | Final MVP scope review | Product owner |
| AMB-021 | **Service selection resolved:** user chooses the government BAN service; use the official IGN Géoplateforme address geocoder at https://data.geopf.fr/geocodage/. AGENTS and diagrams now name this explicitly. Verify adapter parameters, coordinate ordering, limits and failure behavior during integration. DEC-009 defines distance ordering/no radius and request-scoped origin; retention/privacy notice remains AMB-015. Evidence is linked in setup.md. | Adapter integration verification remains | Technical owner |
| AMB-022 | **Company scope resolved:** existing donor workflow with company-name attribution, identical food/packaging restrictions, no company verification, shared accounts, cold-chain handling or tax receipts. The frontend demo now permits explicit unmatched posts for association browsing. Production publication, public visitor access to unmatched donor posts and association claims remain unresolved. Public browsing of association needs is separately resolved by FR-039. | Company implementation; production publication and claim contract | Product + technical owner |
| AMB-023 | **Donation grouping resolved:** one product type per donation; identical units share category, matching attributes and expiry facts. Split mixed groups before offering. | Capture/validation implementation | Technical owner |
| AMB-024 | **Need editing resolved:** freeze category/unit/attributes/seasons once commitments or receipts reference the need. Close it and create another for changed criteria. Old fulfillment never counts for the new need. | Need guards and concurrent-edit tests | Technical owner |

AMB-022–AMB-024 retain frontend decisions from before the merge. AMB-022 and AMB-024 have the backend gaps described above; their presence does not claim backend parity. AMB-023 describes the shared homogeneous-lot requirement.

## Forty-hour scope and verification

The [feature priorities and illustrative 40-hour allocation](features.md#delivery-priorities-and-forty-hour-budget) make the protected flow reviewable. They are a planning proposal, not measured estimates or a delivery guarantee. Advanced metrics are explicitly deferred rather than silently added to the core.

For application delivery, review every M requirement against its linked use-case criteria, plus the NFR verification rows. Test unresolved edge cases only after their policy is agreed; do not encode a guessed policy as a passing test. Optional features cannot compensate for a missing review queue, QR reception, indicators, expiry buckets/distribute-first list or auth/RLS.

For this documentation task, check unique IDs, feature-to-requirement coverage, cross-document links and contradictions against AGENTS.md. Application checks now exist for both directories. Live photo-set evaluation and the connected frontend journey remain unverified; see [readiness](readiness.md).
