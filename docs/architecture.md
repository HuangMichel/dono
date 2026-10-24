# Dono architecture

Dono is planned as a Next.js frontend with donor, association and platform-admin views, calling a separate Python FastAPI backend backed by Supabase. The analysis module belongs to FastAPI. AI supplies evidence; deterministic code matches donations and calculates expiry; association personnel alone decide whether to accept a donation.

This is the target design for the ≤40-hour MVP. The diagrams describe requirements and logical interactions, not implemented endpoints, database migrations, deployed services or measured timings. [AGENTS.md](../AGENTS.md) is authoritative; [requirements.md](requirements.md) records permissions and open decisions, and [features.md](features.md) defines use cases and acceptance criteria.

The proposed [database design](databases.md) and [FastAPI REST API contract](api.md) refine this architecture. Their DB-P01–DB-P07 choices remain provisional where product decisions are still open; they do not claim a deployed database or implemented endpoints.

The [handoff/audit](handoff.md) and [setup plan](setup.md) record the design. FastAPI owns the backend, and the government BAN service via IGN Géoplateforme provides geocoding. The seven editable sources were recovered from commit `70bd4f7` and reconciled with the current specifications. Six HTML views were regenerated in a temporary directory. Their static checks passed, but browser checks and final-path provenance remain incomplete. The ERD HTML is a historical snapshot because the installed renderer does not support its format. See [validation evidence](#validation-evidence) for the exact limits.

## Interactive diagrams

Each HTML file is standalone and uses the existing Archify Classic presentation, with light/dark themes, Live/Still, exploration controls and exports. Open it in a browser. Longer use-case and sequence views use page scrolling to preserve readable text; zoom and node inspection provide more detail.

| View | Interactive diagram | Editable source | Requirement / use-case coverage |
|---|---|---|---|
| 1. System architecture | [System architecture](architecture/dono-architecture.html) | [candidate.json](architecture/candidate.json) | BR-001–BR-008; FR-001–FR-026, FR-033; NFR-001–NFR-008 |
| 2. UML-style use cases | [Actors and system boundary](architecture/use-cases.html) | [use-cases.json](architecture/use-cases.json) | Four product roles, company attribution, applicant and supporting systems; UC-001–UC-013 and UC-015 |
| 3. Donation creation | [Photo → evidence → corrections](architecture/donation-creation.html) | [donation-creation.json](architecture/donation-creation.json) | FR-007–FR-011, FR-018; UC-003–UC-005 |
| 4. Matching and review | [Deterministic matching → human decision](architecture/matching-review.html) | [matching-review.json](architecture/matching-review.json) | FR-012–FR-017, FR-019; UC-006–UC-008 |
| 5. Booking and reception | [Approved offer → booking → QR reception](architecture/booking-reception.html) | [booking-reception.json](architecture/booking-reception.json) | FR-005, FR-006, FR-022–FR-025; UC-010–UC-012 reception boundary |
| 6. Lifecycle | [Donation states and guards](architecture/donation-lifecycle.html) | [donation-lifecycle.json](architecture/donation-lifecycle.json) | FR-015, FR-017, FR-022–FR-024; UC-007–UC-012 |
| 7. Database ERD | [Historical schema snapshot](architecture/database-erd.html) | [Current database-erd.json](architecture/database-erd.json) | Current source has 16 application tables and 154 columns. The historical HTML predates the confirmed company and unopened-package rules. |

The use-case view uses Archify's native Architecture renderer: person icons for human actors, stereotyped rounded cards for use cases, a Dono application boundary, and labeled associations/specialization. It is UML-style rather than strict UML ellipse/arrow notation. Its arrows indicate participation or dependency, not chronology. The sequence and lifecycle views explain ordering.

Association admin and staff specialize an abstract association-personnel actor for review, reception and inventory. This is a conceptual shared responsibility, not an additional stored role or a decision about staff management permissions. OpenAI and the donor are repeated where that improves readability; repeated boxes refer to the same actor. Pharmacy/bin/repair destinations are informational references, and beneficiaries have no MVP account or software interaction.

## Components and trust boundaries

| Component | Responsibility | Boundary / constraint |
|---|---|---|
| Donor browser | Capture photos, inspect indicators, edit working category/facts, match/offer, read status and appointment/QR | Individual and company donations use the same authenticated donor flow. Company attribution belongs to the donation; it creates no company workspace or staff account. |
| Association dashboard | Needs, capacity, slots, human review, today's arrivals, QR reception, gallery, expiry and light stock | Membership in the target association; staff management rights remain AMB-001. |
| Approval console | Manual association approval after registration with RNA/SIRET | `platform_admin`; association approval does not grant donation decision authority. Applicant bootstrap remains AMB-002. |
| FastAPI backend / Python services | Authorization, upload validation, correction handling, matching, expiry calculations, lifecycle guards and operational writes | Server execution; checks actor, ownership/membership and current state on every mutation. |
| Analysis module | Category-schema/provider adapter and validation of structured extraction/indicators; supports the confirmed free-text needs draft path | Logical module within FastAPI, not another deployment. No donation decision authority. |
| OpenAI | Vision extraction and probability indicators; free-text needs → editable structured draft | Server-side calls; never computes operational totals, days left, distance or matching. |
| TypeSafe Jev | Optional probability indicators, or probability part of hybrid mode | S1 stretch behind `ANALYSIS_PROVIDER`; no OCR/date/number extraction. Images require `TypeSafe-Danger-Zone-Images: true`. Jev-only contract sourcing remains AMB-018. |
| Government BAN / IGN Géoplateforme | Address → coordinates from the BAN address index | Code computes Haversine distance. Geocoding failure stays explicit; no routing or travel-time service. |
| Supabase Auth | Identity and sessions | Sign-in method and no-email onboarding need AMB-002; diagrams do not choose a specific authentication protocol. |
| Postgres | Donor/association records, original evidence, working corrections, staff decisions, bookings and inventory movements | RLS scoped by donor ownership / `association_members`; original AI data cannot be edited through correction workflows. |
| Supabase Storage | Donation photos | Private/scoped reads by owner and authorized receiving association; validate uploads before provider calls. |

The system diagram's server frame denotes server-side execution and secret isolation, not a newly specified network firewall or deployment security group. The Supabase frame denotes the managed persistence/auth boundary. Three UI boxes are views in one Next.js frontend. FastAPI is a separate backend process owning all business operations and server secrets. HTTPS/JWT labels express bearer-authenticated API requests. A common public-origin proxy can route /api/v1 to FastAPI; separate local origins use explicit CORS configuration. Next.js does not duplicate provider calls or mutation endpoints.

`OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_SECRET_KEY`, any legacy `SUPABASE_SERVICE_ROLE_KEY`, and `QR_SIGNING_KEY` stay in FastAPI server configuration. A privileged credential does not authorize an actor to bypass product permissions. Donors cannot query another association's raw needs, capacity or membership tables to obtain matches; a controlled listing projection provides the permitted result. Association data, related evidence, bookings, stock and photos retain equivalent access scoping.

## Evidence, corrections and decisions

The original analysis and the working donation facts have different ownership and meaning. Their logical separation is required; the diagrams do not prescribe new physical tables or columns beyond the planned data concepts.

| Layer | Contents | Mutability and use |
|---|---|---|
| Original AI evidence | Provider, model, original category, extracted attributes/date facts, indicators and confidence, linked to the item/photos | Retained unchanged by product edits. A new analysis, if supported, is another attributable result rather than an overwrite. |
| Human working facts | Validated donor category/attribute corrections and their human provenance | Editable in agreed stages. Matching and read-time expiry use current validated facts. Post-offer edits and reanalysis remain AMB-004. |
| Human donation decision | Explicit association approval/refusal and responsible staff actor | Only authorized target-association personnel write it; reversal policy remains AMB-012. |
| Derived views | Days left, expired flag, expiry buckets, FEFO order, distances and operational totals | Computed in code. Expiry derivatives are calculated at read time and never stored as source facts. |

For example, if the AI analyzed an item as clothes and the donor changes the working category to shoes, the old result remains labeled with its original clothes category, provider/model, indicators and confidence. The donor and reviewer see both the correction and a potential indicator mismatch. The old probabilities are not silently reinterpreted as a shoes analysis. Whether reanalysis is mandatory, and which result is current after it, remains AMB-004.

Source date fields include `expiry_date`, `date_type` (DLC/DDM/expiry/PAO) and `pao_months`. PAO means period after opening, such as a jar label marked `12M`. OpenAI can retain that label as evidence. It never creates an opening date or an expiry date from it. Packaged food and para products must be unopened, so the current schema has no `opened_on` field. Unknown, unreadable and ambiguous dates remain explicit. Local dates, expiry day calculations, opening hours and slot display use the IANA zone `Europe/Paris`, including daylight saving changes. Exactly 90 days, today, cumulative versus exclusive buckets, partial dates and unknown-date ordering remain open.

## Interaction design

**Creation.** A donation contains one product type with one or more identical units. Relevant attributes and expiry facts must match across its units. Mixed products, sizes or expiry dates require separate donations. The donor supplies item photos and a label close-up for food/para. The server validates ownership, type and size before any model call. Valid photo references are scoped to the donor's item; OpenAI extraction passes category-schema/contract validation before original evidence is persisted. Failure returns a retry/correction path. Human edits write separate working facts and expose differences. All five categories remain in the MVP: clothes, shoes, food, para and small furniture.

Company donations use this same donor-owned flow. `donor_kind=company` requires a nonempty `company_name` snapshot; individual donations keep that field null. Company verification, company teams, chilled/frozen products, tax receipts and association-initiated claims are deferred.

**Matching and review.** The API reads validated working facts and current association approval, need, capacity and season, geocodes the necessary address, and computes Haversine distances and deterministic eligibility/order/reasons. There is no model participant in this matching sequence. An offer revalidates current constraints. Target-association staff see photos, original indicators/confidence, corrections/mismatch and code-computed expiry before explicitly approving or refusing. The decision write checks membership, state and agreed capacity rules and records the human actor. The donor reads the resulting status inside the app.

**Booking and reception.** The donor submits an offer. Association staff approve it. The donor then chooses an available slot. The app generates the QR only after that booking commits. Last-slot contention must not overbook. The donor brings the donation to the association. Staff validate the QR and inspect the units. If units are missing, staff reduce the working quantity before confirming full reception. The quantity correction, audit history, receipt and stock update commit in one transaction. Reception closes once, with no second delivery or missing remainder. Zero received units cannot confirm reception. A valid scan alone does not receive a donation. Invalid, foreign, repeated or competing requests cannot duplicate effects. Distribution is a later staff-recorded movement. Approval reservation and release policies remain on standby under AMB-008/012.

**Need history.** Freeze category, unit, attributes and seasons once a need has approved/booked commitments or receipt history. Staff close the old need and create a new one when those criteria change. Historical receipts continue to count against the original requirement.

**Lifecycle.** The documented offer path is offered → staff approved → booked → received → distributed, with staff refusal branching from offered. Preparing and capture/analysis-error are conceptual stages, not mandated database enum values. Guard tags and cards explain authorization and operational checks. Expired/bucket/FEFO values are read-side views, not lifecycle states. Refusal ends the current documented offer path; future re-offering remains open. Cancellation, reversals and post-offer edits also remain open. The confirmed reception flow permits a quantity reduction followed by one full closure, not repeated partial deliveries.

Medicines remain excluded. The warning and enforcement details are on standby under AMB-007. Food from individuals and companies must be unopened, non-perishable and stored at room temperature. Packaged para products must also be unopened. Chilled/frozen concern remains a warning indicator; cold-chain donations are outside this MVP. No transport, pickups, route optimization, email or messaging channel is added.

## Open decisions and forty-hour scope

| Design area | Unresolved requirements references | Effect |
|---|---|---|
| Permissions and onboarding | AMB-001 / AMB-002 | Management rights, applicant bootstrap and sign-in method are not inferred from role labels. |
| Uploads and schemas | AMB-003 / AMB-017 | Photo count/limits, final indicator vocabulary and uncertainty handling must be agreed before implementation. |
| Corrections and evidence | AMB-004 / AMB-015 / AMB-018 | Post-offer edits, reanalysis, retention/deletion and optional provider sourcing remain open. Immutable evidence does not mandate perpetual personal-data retention. |
| Expiry and restrictions | AMB-005 / AMB-006 / AMB-007 | Bucket edges, expiry safety policy and unknown-date ordering remain open. Medicine warning/enforcement details are on standby. Unopened packaging and Europe/Paris are confirmed. |
| Matching and capacity | AMB-008 / AMB-009 / AMB-016 | Approval reservations/releases are on standby. Capacity units, season/radius/ties and geocoding disclosure/fallback remain open. Need criteria freeze after commitments or receipts. |
| Booking and lifecycle | AMB-010 / AMB-012 / AMB-013 | Staff approval precedes slot selection; committed booking precedes QR. Cancellation, multi-offer, reversal and QR lifetime remain open. Full reception and quantity correction are confirmed. |
| Reporting and operational targets | AMB-014 / AMB-019 / AMB-020 | No invented impact formula, SLA, accuracy or cost target. |

The required architecture supports the protected flow in the [40-hour plan](features.md#delivery-priorities-and-forty-hour-budget): auth/RLS, original indicators and corrections, expiry buckets/distribute-first list, review, booking and QR reception. It introduces no separate worker fleet, logistics system or messaging infrastructure. Basic needs/capacity/slots and stock remain simple forms and lists. Optional work is cut in the authoritative order: Jev → provider comparison → expiry timeline → AI/human agreement. Advanced impact reporting and later integrations remain outside this baseline.

## Validation evidence

The seven editable JSON sources were recovered from Git commit `70bd4f7`. The system, use-case and sequence sources retain the current FastAPI/BAN architecture. Their text and the lifecycle source now include the confirmed company, packaging, quantity, appointment and reception rules. The recovered lifecycle used schema version 3, which the installed Archify 3.0.1 does not accept. Its eight states and eight transitions now use the supported version 2 lane format with the same transition meanings.

Six views passed all nine showcase static checks, with zero composition errors and zero warnings. Delivery and strict artifact checks passed in `/private/tmp/dono-architecture-recovery-0_n821fv`. Each finalizer exited 1 because Chrome's DevTools pipe ended before browser measurements started. This is a failed browser check, not a passing or skipped check. No current screenshots or perceptual visual review are claimed.

Direct finalization in this repository failed when the environment denied removal of Archify's own temporary directories with `EPERM`. Generation therefore ran in the temporary mirror. The six HTML files, six delivery receipts and eighteen finalize/browser receipts were copied here without changing their bytes. Source and HTML hashes match the temporary files and generated receipts. The receipts retain their original temporary paths. Strict provenance checks at the repository paths fail because those copies have different file identities. They are evidence of temporary generation, not successful finalization at these paths.

The [restoration verification report](architecture/validation/restored-20261025/recovery-report.json) records source/artifact hashes, byte equality, table counts and each gate result. It is a local verification report, not an Archify success receipt.

| View | Temporary-generation summary / full receipt | Final-path strict check |
|---|---|---|
| System | [Summary](architecture/validation/restored-20261025/dono-architecture.finalize-summary.json) · [full](architecture/validation/restored-20261025/dono-architecture.finalize.json) | [Failed provenance](architecture/validation/restored-20261025/dono-architecture.workspace-check.json) |
| Use cases | [Summary](architecture/validation/restored-20261025/use-cases.finalize-summary.json) · [full](architecture/validation/restored-20261025/use-cases.finalize.json) | [Failed provenance](architecture/validation/restored-20261025/use-cases.workspace-check.json) |
| Creation | [Summary](architecture/validation/restored-20261025/donation-creation.finalize-summary.json) · [full](architecture/validation/restored-20261025/donation-creation.finalize.json) | [Failed provenance](architecture/validation/restored-20261025/donation-creation.workspace-check.json) |
| Matching/review | [Summary](architecture/validation/restored-20261025/matching-review.finalize-summary.json) · [full](architecture/validation/restored-20261025/matching-review.finalize.json) | [Failed provenance](architecture/validation/restored-20261025/matching-review.workspace-check.json) |
| Booking/reception | [Summary](architecture/validation/restored-20261025/booking-reception.finalize-summary.json) · [full](architecture/validation/restored-20261025/booking-reception.finalize.json) | [Failed provenance](architecture/validation/restored-20261025/booking-reception.workspace-check.json) |
| Lifecycle | [Summary](architecture/validation/restored-20261025/donation-lifecycle.finalize-summary.json) · [full](architecture/validation/restored-20261025/donation-lifecycle.finalize.json) | [Failed provenance](architecture/validation/restored-20261025/donation-lifecycle.workspace-check.json) |
| Database ERD | [Unsupported renderer result](architecture/validation/restored-20261025/database-erd.tool-attempt.json) | No current generated artifact or passing receipt. |

The restored ERD source matches the current data dictionary's 16 application tables, 154 columns and 30 foreign-key relationships, plus a managed Auth key stub. It includes named enum types, `donor_kind`, `company_name`, and no `opened_on`. The installed Archify CLI rejects `finalize erd` with `cli/unknown-diagram-type`, exit 2. Its existing HTML and earlier capture images remain historical snapshots. They do not represent the updated source and do not prove current browser behavior. No historical receipt was restored as current evidence.

These are documentation checks. There is no application implementation, migration or photo fixture set here; frontend, backend, RLS, concurrency and provider checks did not run.

The finalizer reported a cached update notice: Archify 3.0.1 to 3.2.0, found on 2026-10-24 at 13:54:32 UTC. [Release notes](https://github.com/tt-a1i/archify/releases/tag/v3.2.0). No package was installed or updated.

## Regeneration

The JSON files in the diagram table are the editable sources. Run the installed skill from the repository root, with Node and Chrome/Chromium available. This command requires an environment that permits Archify to remove its own temporary directories and use the Chrome DevTools pipe:

```sh
node /Users/huang/.agents/skills/archify/bin/archify.mjs finalize architecture docs/architecture/candidate.json docs/architecture/dono-architecture.html --quality showcase --out-dir docs/architecture/validation/system-next --json
```

Use `architecture` for system/use cases, `sequence` for the three interactions, and `lifecycle` for donation states. Substitute the input/output paths from the table. Keep deliveries to the same directory sequential. Use a fresh evidence directory after changing an artifact that already has browser evidence. Read the diagnostics and rerun the complete finalizer after a source repair. Update this document's evidence links with the actual result.

`database-erd.json` retains the recovered legacy ERD format and updated field definitions. Its renderer is not installed. Regeneration requires an ERD-capable Archify version or a separately agreed conversion. Do not run the unsupported `finalize erd` command as if it were a verified project command.

For an optional visual inspection after a successful finalization, capture the verified HTML into a fresh directory and inspect its images:

```sh
node /Users/huang/.agents/skills/archify/bin/archify.mjs visual-check docs/architecture/dono-architecture.html --out-dir docs/architecture/validation/system-next-visual --summary --require-provenance
```

The [installed Archify skill](/Users/huang/.agents/skills/archify/SKILL.md) defines validation, repair, provenance and capture checks. Keep generated HTML and delivery receipts together. Do not edit receipt paths or hashes to hide failed provenance checks. Earlier HTML and PNG captures are historical references and remain preserved.
