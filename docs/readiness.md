# Dono readiness report

Updated 2026-10-25. Specification reconciliation and source recovery are complete. Diagram browser validation and current ERD rendering remain incomplete. This repository still contains a design baseline, not a runnable application.

## Confirmed changes

- Company donations remain in the existing donor workflow with company-name attribution. The smaller scope excludes company verification, shared accounts, chilled/frozen handling and tax receipts.
- Packaged food and hygiene products must be unopened. Printed PAO remains label evidence, with no opening-date input or after-opening expiry calculation.
- Local dates, expiry and appointments use `Europe/Paris`; instants are stored/exchanged in UTC.
- One donation contains one product type and identical units with the same matching attributes and expiry facts.
- Need criteria freeze once approved/booked commitments or receipts reference the need. Changed criteria require a new need.
- Staff approve the offer before slot selection. The app creates the booking before generating its QR.
- Staff can reduce the quantity before one full reception. Quantity correction, audit, receipt, stock and status commit together, without a pending remainder or second receipt.
- AI wording uses indicators and uncertainty. Staff explicitly confirm unopened packaging; AI probabilities do not complete that confirmation.
- Seven diagram sources are restored and no longer ignored by Git. See [source and diagram evidence](architecture.md#validation-evidence).

## Verification

| Check | Evidence and result |
| --- | --- |
| Independent business review | No remaining contradictions found in the changed contracts and mockups after correcting audit attribution and company photo prerequisites. |
| Requirement traceability | 8 business, 33 functional and 10 non-functional requirements map to the feature matrix; 22 features, 15 use cases and 76 acceptance criteria have unique definitions. |
| API examples | All 15 JSON examples parse. |
| Documentation links | No broken local file or heading links across 12 Markdown files. All seven restored diagram sources parse as JSON. |
| Mockup source checks | Changed HTML structure, IDs, local links, booking/reception order and company prerequisites checked. No browser rendering claimed. |
| Database/ERD source | Revised dictionary and recovered source contain 16 application tables and 154 columns. Existing ERD HTML remains a historical 153-column view. |
| Six supported diagram views | Static validation, delivery and strict artifact checks passed in a temporary mirror. Browser checks failed because Chrome communication ended before connection. |
| Final-path diagram provenance | Copied HTML/evidence bytes match the temporary outputs. Strict workspace checks fail because delivery identity belongs to the temporary path/inode; receipts were not rewritten. |
| Runtime application checks | Not run: no frontend/backend project, migrations, services or photo fixtures exist. |

The installed Archify version lacks ERD support. No current ERD render or visual acceptance is claimed. Historical screenshots and earlier reported receipts do not establish current validation. Detailed gate results and regeneration commands are in [architecture.md](architecture.md#validation-evidence).

## Remaining work

Medicine refinements and approval reservation/release rules remain on standby. Other open product policies stay in the [decision register](requirements.md#ambiguities-and-decisions-required), including auth/bootstrap, analysis-basis recovery, expiry boundaries, matching and QR exceptions. Public claiming and stock disposal are separate unresolved proposals.

Before implementation, re-estimate the [required flow](features.md#delivery-priorities-and-forty-hour-budget). The illustrative 40-hour allocation contains no optional work to remove. Use the [handoff](handoff.md) for current limitations and next steps.
