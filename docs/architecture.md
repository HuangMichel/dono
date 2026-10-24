# Dono architecture

Dono is planned as one Next.js application with donor, association and platform-admin views, backed by Supabase and a server-side analysis module. AI supplies evidence; deterministic code matches donations and calculates expiry; association personnel alone decide whether to accept a donation.

This is the target design for the ≤40-hour MVP. The diagrams describe requirements and logical interactions, not implemented endpoints, database migrations, deployed services or measured timings. [AGENTS.md](../AGENTS.md) is authoritative; [requirements.md](requirements.md) records permissions and open decisions, and [features.md](features.md) defines use cases and acceptance criteria.

The proposed [database design](databases.md) and [Next.js REST API contract](api.md) refine this architecture. Their DB-P01–DB-P07 choices remain provisional where product decisions are still open; they do not claim a deployed database or implemented endpoints.

## Interactive diagrams

Each HTML file is standalone and uses the existing Archify Classic presentation, with light/dark themes, Live/Still, exploration controls and exports. Open it in a browser. Longer use-case and sequence views use page scrolling to preserve readable text; zoom and node inspection provide more detail.

| View | Interactive diagram | Editable source | Requirement / use-case coverage |
|---|---|---|---|
| 1. System architecture | [System architecture](architecture/dono-architecture.html) | [candidate.json](architecture/candidate.json) | BR-001–BR-006; FR-001–FR-026; NFR-001–NFR-008 |
| 2. UML-style use cases | [Actors and system boundary](architecture/use-cases.html) | [use-cases.json](architecture/use-cases.json) | All four product roles, applicant, supporting systems and optional deployment actor; UC-001–UC-013 |
| 3. Donation creation | [Photo → evidence → corrections](architecture/donation-creation.html) | [donation-creation.json](architecture/donation-creation.json) | FR-007–FR-011, FR-018; UC-003–UC-005 |
| 4. Matching and review | [Deterministic matching → human decision](architecture/matching-review.html) | [matching-review.json](architecture/matching-review.json) | FR-012–FR-017, FR-019; UC-006–UC-008 |
| 5. Booking and reception | [Approved offer → booking → QR reception](architecture/booking-reception.html) | [booking-reception.json](architecture/booking-reception.json) | FR-005, FR-006, FR-022–FR-025; UC-010–UC-012 reception boundary |
| 6. Lifecycle | [Donation states and guards](architecture/donation-lifecycle.html) | [donation-lifecycle.json](architecture/donation-lifecycle.json) | FR-015, FR-017, FR-022–FR-024; UC-007–UC-012 |
| 7. Database ERD | [Full proposed schema](architecture/database-erd.html) | [database-erd.json](architecture/database-erd.json) | All 13 required entities plus photo, correction and retry support; FR-001–FR-025; NFR-001–NFR-006 |

The use-case view uses Archify's native Architecture renderer: person icons for human actors, stereotyped rounded cards for use cases, a Dono application boundary, and labeled associations/specialization. It is UML-style rather than strict UML ellipse/arrow notation. Its arrows indicate participation or dependency, not chronology. The sequence and lifecycle views explain ordering.

Association admin and staff specialize an abstract association-personnel actor for review, reception and inventory. This is a conceptual shared responsibility, not an additional stored role or a decision about staff management permissions. OpenAI and the donor are repeated where that improves readability; repeated boxes refer to the same actor. Pharmacy/bin/repair destinations are informational references, and beneficiaries have no MVP account or software interaction.

## Components and trust boundaries

| Component | Responsibility | Boundary / constraint |
|---|---|---|
| Donor browser | Capture photos, inspect indicators, edit working category/facts, match/offer, read status and appointment/QR | Authenticated owner of the donation; receives only an agreed limited association listing. |
| Association dashboard | Needs, capacity, slots, human review, today's arrivals, QR reception, gallery, expiry and light stock | Membership in the target association; staff management rights remain AMB-001. |
| Approval console | Manual association approval after registration with RNA/SIRET | `platform_admin`; association approval does not grant donation decision authority. Applicant bootstrap remains AMB-002. |
| Next.js API / server actions | Authorization, upload validation, correction handling, matching, expiry calculations, lifecycle guards and operational writes | Server execution; checks actor, ownership/membership and current state on every mutation. |
| Analysis module | Category-schema/provider adapter and validation of structured extraction/indicators; supports the confirmed free-text needs draft path | Logical module within the application, not a required separately deployed microservice. No donation decision authority. |
| OpenAI | Vision extraction and probability indicators; free-text needs → editable structured draft | Server-side calls; never computes operational totals, days left, distance or matching. |
| TypeSafe Jev | Optional probability indicators, or probability part of hybrid mode | S1 stretch behind `ANALYSIS_PROVIDER`; no OCR/date/number extraction. Images require `TypeSafe-Danger-Zone-Images: true`. Jev-only contract sourcing remains AMB-018. |
| API Adresse | Address → coordinates | Code computes Haversine distance. Geocoding failure stays explicit; no routing or travel-time service. |
| Supabase Auth | Identity and sessions | Sign-in method and no-email onboarding need AMB-002; diagrams do not choose a specific authentication protocol. |
| Postgres | Donor/association records, original evidence, working corrections, staff decisions, bookings and inventory movements | RLS scoped by donor ownership / `association_members`; original AI data cannot be edited through correction workflows. |
| Supabase Storage | Donation photos | Private/scoped reads by owner and authorized receiving association; validate uploads before provider calls. |

The system diagram's server frame denotes server-side execution and secret isolation, not a newly specified network firewall or deployment security group. The Supabase frame denotes the managed persistence/auth boundary. Three UI boxes are views in the same Next.js application, not three separate projects. HTTPS/JWT labels express authenticated requests; exact session transport remains an implementation choice.

`OPENAI_API_KEY`, `TYPESAFE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` stay on the server. A privileged server credential does not authorize an actor to bypass product permissions. Donors cannot query another association's raw needs, capacity or membership tables to obtain matches; a controlled listing projection provides the permitted result. Association data, related evidence, bookings, stock and photos retain equivalent access scoping.

## Evidence, corrections and decisions

The original analysis and the working donation facts have different ownership and meaning. Their logical separation is required; the diagrams do not prescribe new physical tables or columns beyond the planned data concepts.

| Layer | Contents | Mutability and use |
|---|---|---|
| Original AI evidence | Provider, model, original category, extracted attributes/date facts, indicators and confidence, linked to the item/photos | Retained unchanged by product edits. A new analysis, if supported, is another attributable result rather than an overwrite. |
| Human working facts | Validated donor category/attribute corrections and their human provenance | Editable in agreed stages. Matching and read-time expiry use current validated facts. Post-offer edits and reanalysis remain AMB-004. |
| Human donation decision | Explicit association approval/refusal and responsible staff actor | Only authorized target-association personnel write it; reversal policy remains AMB-012. |
| Derived views | Days left, expired flag, expiry buckets, FEFO order, distances and operational totals | Computed in code. Expiry derivatives are calculated at read time and never stored as source facts. |

For example, if the AI analyzed an item as clothes and the donor changes the working category to shoes, the old result remains labeled with its original clothes category, provider/model, indicators and confidence. The donor and reviewer see both the correction and a potential indicator mismatch. The old probabilities are not silently reinterpreted as a shoes analysis. Whether reanalysis is mandatory, and which result is current after it, remains AMB-004.

Source date fields include `expiry_date`, `date_type` (DLC/DDM/expiry/PAO) and `pao_months`. OpenAI may extract printed dates and numeric attributes; code performs arithmetic. Unknown, unreadable and ambiguous dates remain explicit. PAO without sufficient opening information cannot yield an invented date. Exactly 90 days, today, cumulative versus exclusive buckets, partial dates, PAO/unknown ordering and reference timezone await AMB-005/AMB-006/AMB-011.

## Interaction design

**Creation.** The donor supplies item photos and a label close-up for food/para. The server validates ownership, type and size before any model call. Valid photo references are scoped to the donor's item; OpenAI extraction passes category-schema/contract validation before original evidence is persisted. Failure stops that branch with a retry/correction path. Human edits then write separate working facts and expose differences. All five categories remain in the MVP: clothes, shoes, food, para and small furniture.

**Matching and review.** The API reads validated working facts and current association approval, need, capacity and season, geocodes the necessary address, and computes Haversine distances and deterministic eligibility/order/reasons. There is no model participant in this matching sequence. An offer revalidates current constraints. Target-association staff see photos, original indicators/confidence, corrections/mismatch and code-computed expiry before explicitly approving or refusing. The decision write checks membership, state and agreed capacity rules and records the human actor. The donor reads the resulting status inside the app.

**Booking and reception.** The donor books only their own staff-approved offer into an available target-association slot. Last-slot contention must not overbook; a successful booking provides an in-app appointment/QR. The donor physically brings the item. Authenticated target-association personnel validate the QR/booking, inspect the linked item and explicitly confirm receipt. A valid scan alone does not approve or receive a donation. Invalid, foreign, repeated or competing reception attempts cannot duplicate stock or capacity/need effects. Distribution is a subsequent staff-recorded stock movement; capacity/need units and exact reservation/release timing remain AMB-008.

**Lifecycle.** The documented offer path is offered → staff approved → booked → received → distributed, with staff refusal branching from offered. Preparing and capture/analysis-error are conceptual stages, not mandated database enum values. Guard tags and associated guard cards explain authorization and operational checks. Expired/bucket/FEFO values are read-side views, not lifecycle states. Refusal ends the current documented offer path; it does not resolve future re-offering policy. Cancellation, reversals, post-offer edits and partial quantities are deliberately left open.

Medicines are never eligible for donation. A high medicine indicator warns and points to a pharmacy without creating an AI refusal. Individual food is limited to non-perishable products at room temperature; chilled/frozen concern warns. Exact thresholds and clarification/blocking interactions remain AMB-007, with no medicine exception permitted. No transport, pickups, route optimization, email or messaging channel is added; drop-off and Haversine matching remain within the agreed MVP.

## Open decisions and forty-hour scope

| Design area | Unresolved requirements references | Effect |
|---|---|---|
| Permissions and onboarding | AMB-001 / AMB-002 | Management rights, applicant bootstrap and sign-in method are not inferred from role labels. |
| Uploads and schemas | AMB-003 / AMB-017 | Photo count/limits, final indicator vocabulary and uncertainty handling must be agreed before implementation. |
| Corrections and evidence | AMB-004 / AMB-015 / AMB-018 | Post-offer edits, reanalysis, retention/deletion and optional provider sourcing remain open. Immutable evidence does not mandate perpetual personal-data retention. |
| Expiry and restrictions | AMB-005 / AMB-006 / AMB-007 / AMB-011 | No invented bucket edges, expiry safety policy, PAO opening date, warning threshold or timezone. |
| Matching and capacity | AMB-008 / AMB-009 / AMB-016 | Units, reservations/releases, season/radius/ties and geocoding disclosure/fallback remain open. |
| Booking and lifecycle | AMB-010 / AMB-012 / AMB-013 | Slot limits, cancellation, multi-offer, reversal, QR lifetime and reception exceptions remain open. |
| Reporting and operational targets | AMB-014 / AMB-019 / AMB-020 | No invented impact formula, SLA, accuracy or cost target. |

The required architecture supports the protected flow in the [40-hour plan](features.md#delivery-priorities-and-forty-hour-budget): auth/RLS, original indicators and corrections, expiry buckets/distribute-first list, review, booking and QR reception. It introduces no separate worker fleet, logistics system or messaging infrastructure. Basic needs/capacity/slots and stock remain simple forms and lists. Optional work is cut in the authoritative order: Jev → provider comparison → expiry timeline → AI/human agreement. Advanced impact reporting and later integrations remain outside this baseline.

## Validation evidence

The six system/use-case/sequence/lifecycle candidates passed Archify `finalize` at `showcase` quality: validation, delivery, strict artifact/provenance checking and real Chrome browser checking. Those six deliveries have nine artifact checks and no composition errors/warnings. These checks validate diagram artifacts, not the future application.

The full-field ERD uses the skill's `standard` profile for a dense schema: 16 proposed application tables with 153 columns, plus a managed `auth.users` referenced-key stub. Its four gates and nine artifact checks pass with zero structural errors. The complete validation receipt records **42 composition warnings: 41 relationship crossings and one static legacy-width readability warning**. Actual browser checks preserve a 7.5px field-text floor through readable vertical scrolling. Eight routed relationships exceed the suggested bend count, and three exceed the suggested stretch. These are documented dense-map limitations, not a showcase pass; use the four domain focus views, field FK references and databases.md for detailed review. No relationship or field was removed to conceal the warnings.

| View | Current finalize summary | Captures and visual-check evidence |
|---|---|---|
| System | [Summary](architecture/validation/system-v3/dono-architecture.finalize-summary.json) | [Light/dark captures](architecture/validation/visual-dono-architecture/dono-architecture.visual-check.html) · [capture receipt](architecture/validation/visual-dono-architecture/dono-architecture.visual-check.json) |
| Use cases | [Summary](architecture/validation/use-cases-v2/use-cases.finalize-summary.json) | [Light/dark captures](architecture/validation/visual-use-cases/use-cases.visual-check.html) · [capture receipt](architecture/validation/visual-use-cases/use-cases.visual-check.json) |
| Creation | [Summary](architecture/validation/donation-creation-v2/donation-creation.finalize-summary.json) | [Light/dark captures](architecture/validation/visual-donation-creation-v2/donation-creation.visual-check.html) · [capture receipt](architecture/validation/visual-donation-creation-v2/donation-creation.visual-check.json) |
| Matching/review | [Summary](architecture/validation/matching-review-v2/matching-review.finalize-summary.json) | [Light/dark captures](architecture/validation/visual-matching-review-v2/matching-review.visual-check.html) · [capture receipt](architecture/validation/visual-matching-review-v2/matching-review.visual-check.json) |
| Booking/reception | [Summary](architecture/validation/booking-reception-v2/booking-reception.finalize-summary.json) | [Light/dark captures](architecture/validation/visual-booking-reception-v2/booking-reception.visual-check.html) · [capture receipt](architecture/validation/visual-booking-reception-v2/booking-reception.visual-check.json) |
| Lifecycle | [Summary](architecture/donation-lifecycle.finalize-summary.json) | [Light/dark captures](architecture/validation/visual-donation-lifecycle/donation-lifecycle.visual-check.html) · [capture receipt](architecture/validation/visual-donation-lifecycle/donation-lifecycle.visual-check.json) |
| Database ERD | [Summary](architecture/validation/database-v6/database-erd.finalize-summary.json) · [full warnings](architecture/validation/database-v6/database-erd.finalize.json) | [Light/dark captures](architecture/validation/visual-database-v6/database-erd.visual-check.html) · [capture receipt](architecture/validation/visual-database-v6/database-erd.visual-check.json) |

Browser checks cover light-theme containment at 1440×900, 1600×1000, 1920×1080 and 2048×1320, dark theme at both endpoints, and READ/Still states. Horizontal containment, readable text, theme resolution and viewer controls passed. The current 2048×1320 light and 1440×900 dark captures were visually inspected for all six views. The sequence-header overlap found during inspection was corrected and the affected artifacts were finalized and captured again. Two reviewed four-bend routes remain readable (API → Auth and personnel → reception); neither has an unresolved crossing.

The final ERD's 2048×1320 light and 1440×900 dark captures were also inspected: columns/types/key badges remain visible, applicant/approver and donor/reviewer are separate roles, and the dense relationship routes retain the warnings listed above. Lower rows continue below the captured viewport; focus/zoom and the full dictionary support detailed inspection. PK/UK badges indicate membership in keys, with composite groups defined in databases.md rather than implying individual-column uniqueness.

Captures sample viewports; longer diagrams continue below the captured area. Automated whole-artifact checks and this sampled visual review are separate evidence. `finalize` reports visual review as not requested, and capture receipts report pending judgment; the inspection above records the separate review without rewriting generated receipts. Earlier receipts/captures remain historical and are not current proof for changed bytes: use the exact links in this table.

The database/API documents provide a proposed physical schema and request/response contract while retaining human decision authority and immutable evidence. `draft` refines Preparing as a proposed stored state, one-target/booking constraints are explicitly provisional, and capacity reservation at approval is DB-P04 rather than a silently resolved product rule. All public REST endpoints are planned Next.js App Router Route Handlers. The analysis module remains part of the same application; supporting tables add no new runtime service or channel.

No application code, database objects, migrations or dependencies were added. Application lint/typecheck/unit/photo-fixture tests cannot run because the application is not scaffolded. They remain the delivery gates in AGENTS.md and NFR-009; RLS, transaction and API behavior are specifications awaiting implementation/testing.

## Regeneration

The JSON files in the diagram table are the editable sources. Run the installed skill from the repository root with Node and a supported Chrome/Chromium available. For example, after editing the system source:

```sh
node .agents/skills/archify/bin/archify.mjs finalize architecture docs/architecture/candidate.json docs/architecture/dono-architecture.html --quality showcase --out-dir docs/architecture/validation/system-next --json
```

Use `architecture` for system/use cases, `sequence` for the three interactions, and `lifecycle` for donation states. Substitute the corresponding input/output paths from the table. Keep delivery attempts into the same output directory sequential. After a changed artifact already has browser evidence, choose a fresh evidence directory; `system-next` above illustrates a new name rather than a reusable history slot. Read the compact diagnostics, repair the affected source, and rerun the complete finalizer. Update this document's evidence links after a successful revision.

For the full database diagram use `finalize erd`, the `database-erd.json` / `database-erd.html` paths, and `--quality standard`. Keep every application column/type/key visible and retain its warning report; do not raise the profile to showcase without resolving its stricter composition requirements.

For a new visual inspection, capture the current verified HTML into another fresh directory and inspect its images:

```sh
node .agents/skills/archify/bin/archify.mjs visual-check docs/architecture/dono-architecture.html --out-dir docs/architecture/validation/system-next-visual --summary --require-provenance
```

The [installed Archify skill](../.agents/skills/archify/SKILL.md) defines the full validation, repair, provenance and capture workflow. Keep generated HTML and its delivery receipt together; editing the HTML manually invalidates the recorded artifact identity.
