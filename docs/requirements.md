# Dono requirements

Status: documentation baseline for a ≤ 40-hour hackathon MVP. No application behavior is implemented or verified by this document.

## Authority and evidence

Read this document with the [feature specification and traceability matrix](features.md).

| Source | Use in this specification |
|---|---|
| [AGENTS.md](../AGENTS.md) | Authoritative product rules, security constraints, provider contract, priorities and verification gates. Overrides every other source. |
| [README.md](../README.md) | Product problem, categories, users, journeys, proposed features and roadmap. |
| [Architecture candidate](architecture/candidate.json) | Planned components, trust boundaries and responsibilities. |
| [Rendered architecture](architecture/dono-architecture.html) | Planned donor/dashboard/platform → FastAPI → analysis, geocoding and Supabase flows. |
| Architecture receipts in `docs/architecture/` | Existing generation/browser-check evidence for the diagram only; not evidence that the application exists or meets requirements. |
| Current documentation request | Explicitly requires editable categorization and immutable original AI indicators, use cases and traceability. |

The updated architecture includes platform administration and geocoding as explicit components. [Database](databases.md) and [API](api.md) specifications refine that planned design; their labeled proposals do not resolve the product ambiguities below. Installed Supabase skill guidance informs the access-control and storage safeguards; it does not determine unresolved product permissions.

Requirement IDs are stable: `BR` = binding business rule, `FR` = functional requirement, `NFR` = non-functional requirement. `UC` and its acceptance criteria are defined in [features.md](features.md). `AMB` identifies an unresolved decision. Referenced IDs are not new definitions.

Priority: **M** = required MVP baseline; **S1–S4** = optional MVP stretch, cut in that order; **P** = post-MVP. **Derived** means a necessary safeguard or explicit documentation recommendation, rather than a behavior already specified in the sources. An open decision remains open even when its surrounding capability is M.

## Product scope

Dono helps individual and company donors offer usable in-kind items to associations that need them and have capacity. It gives staff photos, AI indicators and date information to support their own decision. Staff approve an offer before the donor chooses a slot. A committed booking then provides a QR for reception and light stock recording.

The MVP supports clothes, shoes, non-perishable room-temperature food, parapharmacy/hygiene and small furniture brought by the donor. Packaged food and hygiene products must be unopened. Medicines remain excluded; medicine policy refinements are on standby. A para category is not proof that an item is not a medicine.

Company donations stay in the smaller MVP scope: the existing authenticated donor acts on behalf of a named company and owns the donation. The same food and packaging restrictions apply. Company verification, shared company accounts, chilled/frozen handling and tax receipts are deferred. One donation contains one product type, with any number of identical units sharing category, matching attributes and expiry facts. Mixed groups require separate donations. Public offer discovery and association claiming remain a separate unresolved design proposal, not a new permission granted by company attribution.

The required vertical slice is: authentication and association approval → needs/capacity/slots → photo analysis and corrections → matching and offer → staff review → booking/QR → reception, stock and distribution → expiry buckets and distribute-first list. All donation status is visible inside the application.

Transport, pickups, vehicle routing, delivery assignment, email and messaging channels are outside the MVP. A straight-line distance used for matching is not a travel route. A drop-off appointment is not a transport service. Recipients of redistributed goods are beneficiaries, not MVP application users.

Success is demonstrated by completing this flow with isolated donor and association accounts while preserving human decisions, original indicators and deterministic calculations. No conversion, accuracy, latency, kilograms or financial targets are specified by the sources.

## Personas, actors and permissions

| Persona / actor | Need and permitted responsibility |
|---|---|
| Individual donor (`donor`) | Photograph an item, understand indicators, correct facts/category, find a suitable association, offer, follow status and book their own drop-off. |
| Company donor (`donor`, company attribution) | Use the same workflow on behalf of a named company. The authenticated owner retains access; another account with the same company name gains no permission. |
| Association coordinator (`assoc_admin`) | Prepare the association's needs, capacity and slots; review donations and oversee reception and stock. |
| Association volunteer (`assoc_staff`) | Review offers, receive booked donations and record distribution for an association to which they belong. Fine-grained management permissions remain AMB-001. |
| Platform operator (`platform_admin`) | Manually approve associations registered with RNA/SIRET. Broader administration rights are not established. |
| Analysis service / OpenAI | Extract label facts and return category-specific indicators and confidence. It has no decision authority. |
| Optional TypeSafe Jev | Supply probability indicators only, when enabled. It cannot provide OCR, dates or numeric extraction. |
| Deterministic application services | Compute expiry, matching, distance and operational totals; enforce authorization and transitions. They do not decide item usability on staff's behalf. |
| Supabase Auth, Postgres and Storage | Authenticate users and persist scoped records and donation photos. These are supporting systems, not staff roles. |
| API Adresse | Geocode addresses for deterministic distance calculations. |
| Pharmacy / textile bin / repair café | External redirection destinations. No account, reservation or message is sent to them. |

The matrix below distinguishes established permissions from **TBD**. TBD is not an authorization grant; use no broader access until resolved. An association admin is also association personnel for human review. Every association permission applies only to the relevant membership.

| Action / data | Donor | Assoc. admin | Assoc. staff | Platform admin |
|---|---|---|---|---|
| Read/edit own donor facts and category | Own item; edit timing TBD | Review visibility for addressed offers; editing rights TBD | Same as admin | No general access established |
| Read original AI result/photos | Own item | Offers addressed to own association and its stock | Same as admin | No general access established |
| Overwrite original AI result | Never | Never | Never | Never through product workflows |
| View matching results | Own item; limited association listing | Own association configuration | Own association configuration as authorized | No general access established |
| Send an offer / book / view donor QR | Own donation | No donor impersonation | No donor impersonation | No donor impersonation |
| Approve/refuse a donation | Never | Addressed offers in own association | Addressed offers in own association | No donation decision permission established |
| Manage needs/capacity/hours/slots | No | Own association | TBD: AMB-001 | No general access established |
| Scan reception QR / record stock/distribution | No | Own association | Own association | No general access established |
| View review queue/gallery/expiry list | Own donation status only | Own association | Own association | No global dashboard established |
| Register association with RNA/SIRET | Applicant flow TBD | Applicant flow TBD | Applicant flow TBD | Reviews registration |
| Approve association | No | No | No | Yes |
| Assign roles / invite members / revoke membership | No self-escalation | TBD | No self-escalation | TBD |

## Binding business rules

| ID | Priority | Rule and verification intent | Source |
|---|---|---|---|
| BR-001 | M | AI returns indicators, extracted facts and confidence only. Only authorized association personnel set donation `decision`. AI cards never claim “Accepted” or “Refused”; human decision status is explicitly attributed to staff. | AGENTS §1 |
| BR-002 | M | Code computes all derived dates and numbers, including days left, expired flag, buckets, FEFO, counts and distances. Compute expiry derivatives at read time; do not store them. OpenAI may extract visible dates, numeric facts and PAO months; model-supplied probabilities/confidence are estimates, not operational arithmetic. | AGENTS §2 and provider contract |
| BR-003 | M | Match with deterministic need + capacity + season + Haversine distance. No model call, LLM ranking or model-authored explanation is part of the matching path. | AGENTS §3 |
| BR-004 | M | Medicines cannot be donated. A high medicine indicator produces a warning and pharmacy redirection, never a model-issued refusal. Confirmed medicines cannot proceed through a staff approval override. Uncertain-item handling is AMB-007. | AGENTS §4 |
| BR-005 | M | Individual food donations are limited to non-perishable products stored at room temperature. Chilled/frozen items show a warning indicator and are outside eligible food scope; precise workflow handling is AMB-007. | AGENTS §5 |
| BR-006 | M | No transport, pickups, vehicle routing, email, chat, Telegram or other messaging channel is part of the MVP. Donation status and appointment information stay in the app. | AGENTS §6; current request |
| BR-007 | M | Packaged food and hygiene products must be unopened. Staff verify packaging eligibility; an AI indicator alone does not decide it. Retain printed PAO as label evidence only, with no opening-date collection or after-opening expiry calculation. Company food follows the same non-perishable, room-temperature restriction. | User decisions 2026-10-25 |
| BR-008 | M | Use `Europe/Paris` for local dates, expiry reference dates, opening hours and appointments. Store and exchange instants in UTC. Apply daylight-saving offsets from the timezone rules; do not use a fixed UTC offset. | User decisions 2026-10-25 |

## Functional requirements

### Identity, access and association setup

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-001 | M | Authenticate users and enforce the four product roles on reads and writes; donors access only their own donations and staff access only association data allowed by membership. Role assignment cannot come from a user's editable profile fields. | AGENTS; derived security safeguard |
| FR-002 | M | Register an association with RNA/SIRET and expose a manual approval action to platform admins. Unapproved associations must not receive new matched offers; applicant bootstrap and verification details remain AMB-002. | README; derived approval gate |
| FR-003 | M | Maintain association needs using a structured form: category, matching attributes, quantity and season. Freeze category, unit, attributes and seasons when approved/booked commitments or receipts reference the need. For different criteria, close it and create a new need; previous receipts must not fulfill the new need. Exact units and season vocabulary remain AMB-008/AMB-009. | README; user decisions 2026-10-25 |
| FR-004 | M | Accept free-text needs and return an editable AI-structured draft for staff confirmation before saving. Parse stated quantities; do not invent or calculate them with AI. The form remains available if parsing fails. | README; derived confirmation safeguard |
| FR-005 | M | Maintain capacity per category and use it consistently in matching, review and reception. Reject operations that would overcommit the agreed capacity unit; reservation/release timing remains AMB-008. | README; derived consistency safeguard |
| FR-006 | M | Maintain opening hours and drop-off slots in `Europe/Paris` and show available appointments to approved donors. Slot limits and update rules remain AMB-010. | README; BR-008 |
| FR-033 | M | Let an authenticated donor offer on behalf of a company, retaining `donor_kind` and a required company name on that donation. Use the existing owner-scoped offer, review, booking and reception flow. No company verification, shared company accounts, tax receipts or cold-chain workflow is included. | User decisions 2026-10-25 |

### Capture, analysis and correction

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-007 | M | Capture one product type per donation, allowing identical units with the same category, matching attributes and expiry facts. Split mixed groups before offering. Capture item photos and a readable food/para label close-up; validate files before provider calls. Total photo cap remains AMB-003. | AGENTS security; user decisions 2026-10-25 |
| FR-008 | M | Analyze the five supported categories using category-specific structured schemas and return the AGENTS provider contract: provider, model, category, extracted facts, indicators and confidence. Default to OpenAI. Invalid responses and provider errors are visible failures, never successful empty analyses. | AGENTS; derived failure behavior |
| FR-009 | M | Display available indicator values, probabilities/levels, overall confidence and analysis provenance with photos. Missing facts remain unknown; probabilities are visibly estimates. Warn for medicine and chilled/frozen-food indicators. | AGENTS; README |
| FR-010 | M | Let the donor edit the working category and extracted facts such as size/date separately from the original AI output. Validate corrections; matching and expiry use the current validated facts. Do not let donor edits change indicators, confidence, provider or model. Editing after an offer remains AMB-004. | Current request; README |
| FR-011 | M | Preserve the original AI result and indicators immutably. Store human corrections separately, visibly distinguish original vs corrected values, and retain earlier results if reanalysis is offered. A category change cannot silently relabel old category-specific indicators as a new analysis. | Current request; derived provenance safeguard |
| FR-012 | M | Make “Other options” available using redirect points such as pharmacies, textile bins and repair cafés, including when no suitable association is found. No booking or communication with these destinations is required. | README; AGENTS medicine rule |

### Matching, offers and human review

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-013 | M | Geocode supplied locations through API Adresse and compute Haversine distance in code. Never invent coordinates or a distance if geocoding fails. Address precision, fallback and radius remain AMB-009/AMB-016; the selected government BAN endpoint is recorded in AMB-021; adapter behavior still needs integration verification. | AGENTS; README; derived failure behavior |
| FR-014 | M | Return eligible associations using current working facts, needs, capacity and season, with deterministic distance ordering and understandable code-generated match reasons. Revalidate relevant constraints before committing an offer or approval. Scoring, ties and radius remain AMB-009. | AGENTS; README; derived stale-data safeguard |
| FR-015 | M | Allow the donor to send an offer to a matched, approved association and track its in-app status: offered → staff approved/refused → booked → received → distributed. A refusal is a branch, not a prerequisite for booking. Multi-offer, cancellation and re-offering rules remain AMB-012. | README |
| FR-016 | M | Show the target association a review queue containing photos, original indicators/confidence, working category/facts, correction differences and code-computed expiry information. Other associations must not see the offer. | README; current request |
| FR-017 | M | Let authorized association personnel explicitly approve or refuse an offer and persist the human actor and decision. No AI/provider or donor can set that decision. Reversal, reasons and expiry/food restriction handling remain AMB-007/AMB-012. | AGENTS; derived actor attribution |

### Expiry and inventory

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-018 | M | Retain source `expiry_date`, `date_type` (DLC/DDM/expiry/PAO) and `pao_months` where applicable, plus validated human corrections separately. Distinguish missing/unreadable/ambiguous values from a known date. Never manufacture a date from an unreadable label. | AGENTS; README |
| FR-019 | M | Calculate days left, expired flag and bucket at read time using source facts and the current `Europe/Paris` date. Support expired, <7, <30, <90 and >90-day views plus unknown dates. Overlap, exactly 90, today and partial dates remain AMB-005/AMB-006. No derived expiry column or model arithmetic. | AGENTS; BR-008 |
| FR-020 | M | Provide a distribute-first list of received, undistributed items ordered FEFO by usable expiry information. Printed PAO alone supplies no expiry date for an unopened product. Make unknown dates visible; their ordering remains AMB-006. | AGENTS; README; BR-007 |
| FR-021 | M | Provide an association image gallery with indicator overlays and basic category/indicator/expiry filters, expiry counts and a distribute-first list. Counts respect the selected scope and avoid double counting; detailed metric definitions remain AMB-014. | README; AGENTS protected expiry scope |
| FR-022 | M | Record reception and distribution as light inventory movements. Reception adds received stock; distribution removes recorded quantities from that stock without negative inventory or duplicate effects. Needs and capacity update according to the agreed units and lifecycle policy in AMB-008. | README; derived consistency safeguards |

### Booking and reception

| ID | Priority | Requirement | Basis |
|---|---|---|---|
| FR-023 | M | Permit booking only for a staff-approved offer and an available slot at the target association. Confirm the booking consistently under competing requests and issue a QR tied to it. Donors can retrieve appointment and QR in-app. | README; derived concurrency safeguard |
| FR-024 | M | Allow authenticated target-association personnel to validate a booking QR and confirm one full reception. Before confirming, staff can reduce the quantity to the actual positive quantity present, never increase it. Atomically audit any change and commit working quantity, receipt, stock and received status. Preserve the original offered quantity in the audit; create no pending remainder or second receipt. Zero quantity does not create a receipt. Other QR exceptions remain AMB-013. | README; user decisions 2026-10-25 |
| FR-025 | M | Show today's booked drop-offs to association personnel, link each to its offer and reception state, and reflect reception/distribution changes in the donor's own status view. No outbound notification is sent. | README; AGENTS no-channel rule |

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

## Analysis and data responsibilities

| Category | Extracted / observed information to support | Indicator examples |
|---|---|---|
| `clothes` | Garment type, size, season | Wear, stains, holes, pilling |
| `shoes` | Shoe type and size | Complete pair, sole wear, upper damage |
| `food` | Product, printed date and DLC/DDM type | Packaging damage, swollen can, chilled/frozen concern |
| `para` | Product, printed expiry, PAO months | Seal, medicine resemblance |
| `furniture` | Item type, size class | Condition, visible damage |

These are source-backed schema intentions, not an exhaustive finalized indicator-key vocabulary (AMB-017). Days left belongs to code-computed display, never model extraction; the pre-review README grouped it with indicators, and the reviewed README separates those responsibilities. Unknown dates and unobserved seals must not be represented as certain facts.

Data concepts follow the existing plan, without defining SQL or adding a schema:

| Planned entity / concept | Required responsibility |
|---|---|
| `profiles`, `associations`, `association_members` | Identity, association approval and membership-scoped permissions; approval is separate from donation decisions. |
| `needs`, `capacity` | Current association demand and available intake space under agreed units. |
| `donations` | Donor-owned item, current working facts/category, target offer and staff-controlled decision/status. Exact offer cardinality is open. |
| `donation_analysis`, `donation_indicators` | Original provider/model/category/facts/confidence and indicators; immutable through application edits. |
| Human correction record / representation | Separate working corrections and actor provenance; physical representation is not decided here. |
| `expiry_info` | Source date/type/PAO facts and corrections only; never days left, expired flags, buckets or FEFO ranks. |
| `slots`, `bookings` | Association appointments and approved-donation reservations with a QR reference. |
| `inventory_movements` | Actual received/distributed quantities; pending offers are not received stock. |
| `redirect_points`, photo storage | Alternative destinations and access-controlled item photos. |

Original AI indicators survive category edits and staff decisions. Staff can disagree with an indicator; disagreement is not an update to the original result. Whether a new category requires another analysis, and how multiple results are selected for display, remains AMB-004.

## Non-functional requirements

| ID | Priority | Requirement and observable verification | Basis |
|---|---|---|---|
| NFR-001 | M | Enforce donor ownership and `association_members` scoping in RLS for association data; apply equivalent authorization to related analysis, indicators, bookings, stock and photos. Verify direct requests as well as UI navigation with two donors and two associations. Donor matching uses an explicitly limited listing projection, not unrestricted reads of another association's tables. | AGENTS; derived least-access boundary; Supabase skill |
| NFR-002 | M | Keep `OPENAI_API_KEY`, `TYPESAFE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only and out of client bundles/logs. Never commit `.env*` except `.env.example`. Privileged server paths must recheck actor authorization and cannot silently bypass product isolation. | AGENTS; Supabase skill |
| NFR-003 | M | Validate uploads by allowed type and configured size, reject malformed files before analysis, and scope photo reads to owner/authorized receiving association. Exact formats/limits and retention remain AMB-003/AMB-015. | AGENTS; derived storage safeguard |
| NFR-004 | M | Ensure retries/concurrent requests cannot produce duplicate offers unintentionally, overbook a slot or duplicate reception/distribution effects. Validate state and authorization at mutation time and surface conflicts for refresh/retry. Offer cardinality and capacity policy remain open. | Derived integrity safeguard |
| NFR-005 | M | Preserve attribution between original AI output, human corrections and human decisions. Editing endpoints cannot mutate original AI records; stale screens cannot silently overwrite current operational state. Reanalysis/deletion policy is open. | Current request; derived integrity safeguard |
| NFR-006 | M | Handle analysis/geocoding failures with an understandable in-app error and retry path. Preserve known facts and avoid fabricated indicators, distances or success states. A failed AI call never becomes a refusal or approval. Numeric timeout/latency targets remain AMB-019. | Derived reliability safeguard |
| NFR-007 | M | Support the donor flow in a mobile browser and staff review/reception in a browser, with readable uncertainty, labeled inputs and warnings/status understandable without color alone. Offline operation and installability are not established by the “PWA” architecture label. | README/architecture; derived usability baseline |
| NFR-008 | M | Use one provider-independent contract and category-schema validation, with OpenAI as the required provider. Calculations remain independently testable using an explicit reference date/input set; provider selection never changes human decision authority. | AGENTS |
| NFR-009 | M | Before application delivery, pass the planned frontend lint/typecheck/tests and backend Ruff/mypy/pytest checks; test expiry today/expired/unreadable and resolved bucket edges, matching full capacity/season/distance, plus analysis parsing and the 25–35-photo fixture set including medicines/para. Verify no UI path attributes a decision to AI. The application and fixtures are not present at this documentation baseline. | AGENTS verification; derived resolved-edge coverage |
| NFR-010 | M | Keep implementation within ≤40 hours and the Next.js/TypeScript/Tailwind/shadcn frontend, Python FastAPI backend, Supabase, OpenAI and government BAN geocoding architecture. Check package versions before adding dependencies. Preserve protected scope and remove optional work in the AGENTS cut order. | AGENTS; README |

## Ambiguities and decisions required

Entries remain unresolved unless explicitly marked resolved; there are no hidden defaults. The “needed before” column identifies dependent work; unrelated implementation need not wait. The suggested decision owner is a documentation recommendation, not an assigned project role. No ambiguity permits violating BR-001–BR-008.

| ID | Open question / source gap | Needed before | Suggested owner |
|---|---|---|---|
| AMB-001 | Which management actions can `assoc_staff` perform? Who assigns/revokes roles or invites members? Does platform administration have any access beyond association approval? | Authorization policies and member UI | Product owner |
| AMB-002 | How does the first association applicant become its admin? Is RNA, SIRET or both required and is formatting checked? What is the pending/rejected association experience? Which Supabase sign-in method works without outbound email? | Auth/onboarding implementation | Product + technical owner |
| AMB-003 | Does “1–2 photos + label close-up” mean two or three total? Which MIME types, byte limits, dimensions and replacement behavior are supported? | Upload configuration | Technical owner |
| AMB-004 | General post-offer edits, category reanalysis and failed reanalysis remain open. The one agreed exception is a staff quantity reduction committed with reception under FR-024. Define how a successful first analysis becomes the retained basis if a concurrent human edit prevents seeding, without overwriting human facts. | Correction and lifecycle implementation | Product owner |
| AMB-005 | Are expiry buckets cumulative filters (<7 ⊂ <30 ⊂ <90) or exclusive bands? Exactly 90 days is absent from `<90` / `>90`. Is “today” expired or zero days remaining? | Expiry arithmetic and UI labels | Product owner with association staff |
| AMB-006 | **PAO handling resolved:** opened packaged products are ineligible; do not collect an opening date or derive after-opening expiry. Printed PAO remains evidence. Month/year-only date interpretation and unknown/PAO-only FEFO ordering remain open. | Remaining expiry parsing/FEFO policy | Product + technical owner |
| AMB-007 | **Medicine refinements on standby.** Existing medicine exclusion and warnings remain. Warning thresholds, clarification and DLC/DDM intake handling remain unresolved. Unopened packaging and the same ambient-food rule for company donors are agreed in BR-007; no model may approve/refuse or override exclusions. | Safety-related workflow gates | Product owner with association staff |
| AMB-008 | **Approval reservation/release policy on standby.** Need/capacity units and lifecycle holds remain provisional. One product type per donation and atomic downward quantity correction at full reception are agreed; neither selects a cancellation/no-show release rule. | Capacity/matching transactions | Product owner with association staff |
| AMB-009 | What are the need/season eligibility vocabulary, matching weights if any, search radius and tie-break? Does “distance ordering” mean strict nearest-first after eligibility? What happens with unknown season/location? | Matching behavior and tests | Product owner |
| AMB-010 | **Order resolved:** donor offer, staff approval, donor slot selection, committed booking, then QR. Slot duration/limits, overlap, booked-slot changes, cancellation/rescheduling and intake-address/hours changes remain open. Timezone is fixed by BR-008. | Remaining slot/booking policy | Product owner |
| AMB-011 | **Resolved:** `Europe/Paris` defines local dates, expiry reference dates, hours and appointments. Store/exchange instants in UTC and use timezone daylight-saving rules. Test local midnight and clock changes; never guess an ambiguous local appointment time. | Date/slot implementation and tests | Technical owner |
| AMB-012 | One or several target associations per item? Can a refusal be reversed, an item re-offered, an offer withdrawn or an approval revoked? Are refusal reasons required? Exact allowed transition/retry rules are unspecified. | Offer state model | Product owner |
| AMB-013 | **Reception resolved:** close once with the actual positive quantity after any audited downward correction; no pending remainder or later partial receipt. Zero/no-show handling remains on standby. QR lifetime, invalidation, early/late arrivals, camera failure and mismatched items remain open. A QR identifies a booking; it grants no standalone authority. | Remaining QR exceptions | Product + technical owner |
| AMB-014 | Which dashboard items are in stock vs offered/approved? What defines an unreadable-date count, average shelf life, match, diverted kg, avoided cost or “expired item stopped”? No formulas or empirical factors are supplied. | Metrics implementation | Product owner |
| AMB-015 | Photo/fact retention, account deletion, analysis deletion and privacy notice content are unspecified. “Immutable” means no silent edit to AI evidence, not a decision to retain personal data forever. | Retention policy and release | Product owner |
| AMB-016 | What donor address precision/location permission and fallback are supported if API Adresse has no result? Which association contact/address details are exposed in matching? | Geocoding and donor-facing listing | Product owner |
| AMB-017 | Final schema fields, indicator keys, confidence scales, probability bounds, low-confidence prompts and how unknown category is handled are unspecified. Do not infer a sixth category or force a confident classification. | Provider schemas/validation | Product + technical owner |
| AMB-018 | Jev-only results cannot supply OCR/facts or the required category by extraction. What supplies those contract fields, and is image support usable? Optional modes must remain disabled until resolved. | S1 provider work | Technical owner |
| AMB-019 | No supported device matrix, accessibility conformance target, model/cost budget, response-time target or uptime target is specified. Do not invent an SLA or accuracy claim. | Performance planning / deployment | Product + technical owner |
| AMB-020 | The pre-review README labeled advanced metrics and formal impact reporting MVP. The reviewed README now aligns with proposed post-MVP deferral (FR-030); confirm if a simple measured counter must instead be included. This wording alignment does not resolve the product choice. No estimated factors are authorized. | Final MVP scope review | Product owner |
| AMB-021 | **Service selection resolved:** user chooses the government BAN service; use the official IGN Géoplateforme address geocoder at https://data.geopf.fr/geocodage/. AGENTS and diagrams now name this explicitly. Verify adapter parameters, coordinate ordering, limits and failure behavior during integration. Location/radius/privacy decisions remain AMB-009/016. Evidence is linked in setup.md. | Adapter integration verification remains | Technical owner |
| AMB-022 | **Company scope resolved:** existing donor workflow with company-name attribution, identical food/packaging restrictions, no company verification, shared accounts, cold-chain handling or tax receipts. Public offers/association claims remain an independent unresolved proposal. | Company implementation; separate discovery decision if retained | Product + technical owner |
| AMB-023 | **Donation grouping resolved:** one product type per donation; identical units share category, matching attributes and expiry facts. Split mixed groups before offering. | Capture/validation implementation | Technical owner |
| AMB-024 | **Need editing resolved:** freeze category/unit/attributes/seasons once commitments or receipts reference the need. Close it and create another for changed criteria. Old fulfillment never counts for the new need. | Need guards and concurrent-edit tests | Technical owner |

## Forty-hour scope and verification

The [feature priorities and illustrative 40-hour allocation](features.md#delivery-priorities-and-forty-hour-budget) make the protected flow reviewable. They are a planning proposal, not measured estimates or a delivery guarantee. Advanced metrics are explicitly deferred rather than silently added to the core.

For application delivery, review every M requirement against its linked use-case criteria, plus the NFR verification rows. Test unresolved edge cases only after their policy is agreed; do not encode a guessed policy as a passing test. Optional features cannot compensate for a missing review queue, QR reception, indicators, expiry buckets/distribute-first list or auth/RLS.

For this documentation task, check unique IDs, feature-to-requirement coverage, cross-document links and contradictions against AGENTS.md. Application test commands and photo-set evaluation cannot run until the application and fixtures exist.
