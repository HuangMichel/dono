# Expiry and FEFO rules — expiry-v1

Status: **proposed deterministic MVP defaults, not implemented**. This resolves AMB-005/006 and the date portion of AMB-007. [AGENTS.md](../AGENTS.md) remains unchanged. [Analysis schemas](analysis-rules.md) extract source facts; this policy defines Python calculations and command guards. [Executable acceptance scenarios](rules-test-cases.md) are specifications for future tests, not existing application tests.

## Source facts, reference time and persistence

Use current owner facts/expiry_info for donor reads and the recipient's immutable offer facts_snapshot for association reads, reception and inventory. Source opening_state lives in para attributes; opened_on is a human source date in expiry_info/snapshot. Never infer opening from photo time, upload time, current time, a broken seal or the PAO icon. Keep original model dates/indicators separate from donor corrections.

For every read/command, inject one UTC instant as_of and one IANA timezone. Recipient/stock/booking operations use that association's timezone; owner-only drafts/matching previews use Europe/Paris as the explicit MVP reference. Convert as_of to a local date before subtraction; never subtract UTC midnights or divide elapsed seconds by 86400. DST changes do not change calendar-day subtraction. Returned as_of, timezone and reference_date make a result reproducible.

Python validates/normalizes an exact, unambiguous printed/human date into expiry_date as a **source fact** on input; that is not a derived expiry. Store partial text/precision instead of an invented exact source date. Only at read/command time compute partial-date upper bounds, PAO anniversaries, effective_expiry_date, days_left, expired, bucket, date restrictions and FEFO rank. Never persist these in rows, snapshots, movements, retry caches or logs. Operational review/booking deadlines remain distinct stored validity facts, unchanged by this revision.

## Source validation and uncertainty

| Source case | Stored source facts | Read-time interpretation |
|---|---|---|
| Exact day, unambiguous ISO YYYY-MM-DD or explicit day-first date | Valid expiry_date, precision=day, readable, known type; retain raw label. | That calendar date. ISO/calendar validation in Python. |
| Numeric day/month both ≤12 without explicit format confirmation, e.g. 03/04/2026 | expiry_date=null, raw_label retained, precision=unknown, readability=readable. | unknown / ambiguous_date. No French-locale guess. Human may explicitly confirm an ISO date before offering. |
| No year, two-digit year, multiple conflicting dates, invalid calendar date | Preserve raw text; no invented exact source date. Conflicting/ambiguous uses unknown precision. Invalid human ISO input is 422; invalid provider exact-date output is invalid analysis. | unknown / ambiguous_date, conflicting_dates or invalid_date as applicable. Never infer current year/century or silently choose a label. |
| Readable DDM month/year | expiry_date=null, precision=month, raw_label contains one MM/YYYY or YYYY-MM token with four-digit year. | Last calendar day of that month, including leap years; computed only. Label it a month-end interpretation, not printed day precision. |
| Readable DDM year only | expiry_date=null, precision=year, raw_label has one four-digit year. | December 31 of that year, computed only. |
| Para absolute expiry month/year | expiry_date=null, type=expiry, precision=month, one clear MM/YYYY or YYYY-MM token. | Last calendar day of that month, computed only. Year-only para expiry stays unknown. |
| DLC or generic food expiry without a reliable full day, or unknown date type | Partial/raw facts only. | unknown / incomplete_strict_date or date_type_unknown. No month/year extrapolation for DLC. |
| Unreadable label supplied | expiry_date=null, precision=unknown, readability=unreadable; raw fragments if any. | unknown / unreadable_date. Missing label is instead unknown / missing_date. |
| Non-date working category with unexpected date/PAO facts or unresolved original strict-label concern | Retain facts/evidence, never erase with a category override. | unknown / category_date_conflict and human clarification; no automatic not_applicable shortcut. |
| Clothes/shoes/furniture with no relevant date facts | Explicit empty dates object. | not_applicable; do not classify ordinary undated furniture as an unreadable food label. Unexpected date evidence remains visible for human classification review. |

A partial-date parser accepts one standalone MM/YYYY, YYYY-MM or YYYY token, optionally following known label wording: "à consommer de préférence avant fin", "best before end", "à utiliser avant fin" (case/space insensitive). It does not extract a date from arbitrary lot codes or several tokens; other forms stay unknown for human clarification. Exact day-first parsing accepts DD/MM/YYYY only when day>12 (or explicit human format confirmation); text month names require human ISO confirmation in this minimal MVP. raw_label remains the visible source text, never a computed month-end date. The model may copy a full source date into ISO, but Python must validate it against the raw evidence and must not let a model resolve an ambiguous order.

For food, opening invalidates the printed unopened shelf-life assumption: opened food is outside the MVP intake profile. Preserve its source label and show unknown / opened_food for effective expiry; do not calculate a new food life. Food donation is still restricted to nonperishable, room-temperature products. The policy does not turn a DLC on a chilled item into eligibility.

## PAO and combined limits

| Source state | Python result |
|---|---|
| PAO only, confirmed unopened | No running PAO calendar limit: not_applicable with date_basis=pao_unopened. Do not set days_left to pao_months×30. |
| PAO, opening_state unknown | unknown / opening_state_unknown; clarify state before approval/reception. |
| PAO, opened, opened_on missing/ambiguous/future | unknown / opening_date_missing or invalid_opening_date; no inferred start and no approval/reception until corrected source facts. |
| PAO, opened, valid human opened_on and printed positive months | Add calendar months in Python, preserving day where possible and clamping to the last day of the target month. Use that anniversary as the final valid date; expired only the following local day. |
| PAO, opened, months missing | unknown / pao_duration_missing; do not substitute a standard manufacturer duration. |
| Absolute date plus PAO, confirmed unopened | Use the absolute date; PAO not running. |
| Absolute date plus applicable PAO, both reliable | effective_expiry_date is the earlier of the absolute date and PAO anniversary. Ties are one date/bucket, not two counts. |
| Absolute date plus PAO with unknown applicability/start | Overall effective date unknown; retain both source constraints and flag clarification. A separately known already-passed strict absolute date still blocks a physical command. Do not imply validity from the later/only-known limit. |

Calendar-month examples: 2026-01-31 +1 month → 2026-02-28; 2024-01-31 +1 → 2024-02-29; 2024-02-29 +12 → 2025-02-28. These are Dono's explicit calculation defaults; they are not a manufacturer guarantee. Model arithmetic, 30-day approximations, unrecorded opening assumptions and storing the calculated anniversary are forbidden.

For food, date_type=DLC or DDM, or expiry for an explicitly printed generic EXP label treated conservatively as strict; do not interpret food storage-after-opening instructions as cosmetic PAO. For para, printed absolute dates map to expiry, with PAO retained separately when present. The existing date_type enum remains unchanged. The model extracts printed months only; pao_months is 1–120 in this MVP. opened_on must be a valid human ISO date no later than the relevant local reference date.

## Exclusive buckets and boundary cases

Let d = effective_expiry_date − reference_date in **Python calendar days**. Every stock lot belongs to exactly one bucket. The literal `<7 / <30 / <90 / >90` bounds in AGENTS remain; today and exactly 90 fill their explicit boundary gaps. The API returns a single bucket key, not cumulative flags.

| Bucket key | Exact rule | UI meaning |
|---|---|---|
| expired | d < 0 | Date passed; type-specific meaning below. |
| today | d = 0 | Date today, not yet expired. |
| lt_7 | 1 ≤ d < 7 | 1–6 days. |
| lt_30 | 7 ≤ d < 30 | 7–29 days. |
| lt_90 | 30 ≤ d < 90 | 30–89 days. |
| at_90 | d = 90 | Exactly 90 days. |
| gt_90 | d > 90 | More than 90 days. |
| unknown | No reliable applicable effective date | Missing, unreadable, ambiguous, conflict, incomplete strict date or unresolved PAO. |
| not_applicable | No date needed/running under this policy | Ordinary undated clothes/shoes/furniture or confirmed unopened PAO-only para. |

For a reliable date, expired=(d<0), including false today. For unknown/not_applicable, effective_expiry_date/days_left/expired are null; absence never becomes false, zero or a very distant date. unknown_reason is populated only for unknown; not_applicable has a date_basis explaining why. expired means **date passed**, not "unsafe" and never a staff decision; for DDM the UI must say "DDM passed" rather than "unsafe/AI refused".

At d=7 use lt_30; at 30 use lt_90; at 90 use at_90; at 91 use gt_90. A separate expired_count is an alias of that bucket count, not an additional category to sum. unknown_count includes all unknown reasons, unreadable_count is its subtype and not_applicable_count is separate. Counts scope received-undistributed lots once by donation/receipt, using the same filters/reference instant; no duplicate joins across analyses/offers.

## DLC, DDM, expiry and human intake checks

DGCCRF distinguishes DLC as a deadline and DDM as a quality date that may be passed under suitable product/packaging conditions. The proposed Dono defaults below are operational safeguards, not an AI judgement or a general guarantee for every product. [Official DLC/DDM guidance](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/date-limite-de-consommation-et-date-de-durabilite-minimale-ce-que-vous-devez-savoir)

Cosmetic labeling distinguishes absolute durability and a duration after opening; a PAO icon does not start a clock by itself. [Official cosmetics labeling guidance](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/etiquetage-de-vos-produits-cosmetiques-comment-le-decrypter)

| Current facts at a physical command | Required behavior |
|---|---|
| Reliable DLC/expiry/applicable PAO passed | No approval/reception/distribution command may commit. Return intake_date_restriction with code date_passed. Do not automatically set decision/status or delete stock. Staff may refuse/cancel the unreceived offer; received stock remains visible as blocked. |
| Strict DLC/expiry source incomplete, ambiguous or unreadable; unresolved applicable PAO | Clarify source facts before approval/reception/distribution; return date_clarification_required. A manual acknowledgement cannot manufacture the missing strict date/start. |
| Reliable strict date today/future | Date guard passes for this local day; staff still decide and verify condition/intake rules. No safety guarantee or exception to medicine/cold-food exclusion. |
| Food DDM passed | Not automatically ineligible. Approval/reception/distribution needs ddm_passed_ack=true and nonempty human reason after checking product/packaging and association policy. Acknowledgement is not a declaration of universal food safety. |
| Food unknown/absent DDM or unspecified date marking without evidence of a strict deadline | Bucket unknown, manual date_review_ack=true and human reason required. Any known strict/ambiguous DLC evidence takes precedence and cannot be bypassed by blanking date_type. |
| Para has no date facts/unknown marking, but no known strict label or PAO | Bucket unknown, date_review_ack=true and human reason; if a strict label/PAO is present but unreadable, use clarification rule above. |
| Confirmed unopened PAO-only, or ordinary undated non-date category | not_applicable; no invented shelf life or date acknowledgement solely for that reason. Other required human intake checks remain. |

Use all source constraints in the current working/frozen evidence scope, including visible original strict-date concerns. Changing category/date_type to null cannot erase a known strict-date conflict; personnel must explicitly resolve the source conflict before a restricted command, with a recorded reason. A model's warning is not factual confirmation: personnel may clarify a falsely identified DLC/medicine using actual label evidence and source corrections, never approve a confirmed excluded/expired strict item by checkbox. If active-offer facts need correction, withdraw and re-offer under the existing model; no edit to frozen history.

Approval uses current local date. Booking/slot listing additionally checks a known strict date against the selected slot's local start date; do not offer an appointment after it. Reception rechecks current local date, including a grace window crossing midnight. Distribution rechecks the received lot's frozen sources with current reference date. Each command evaluates guards in Python using authoritative transaction time/locked source facts; no write of the computed result. A date failing later leaves the original staff decision/history intact and does not extend/reopen reservations. DDM acknowledgements are checked afresh where applicable; reuse does not silently assume last week's review still suffices.

## Python guard context and atomic command fencing

The existing one-RPC atomic write boundary is preserved. Before a physical command, FastAPI reads authorized source facts/evidence plus a database UTC reference instant, computes expiry-v1 in Python, then supplies **server-only** guard context to the existing restricted command: source revision/offer revision, sorted completed scoped analysis IDs, the reference day's UTC start and next local midnight, and validated human acknowledgements. No such context is accepted from public HTTP clients or stored as an expiry result.

Under the existing donation/parent locks, the database command verifies unchanged source/evidence identities and that its authoritative clock is within [day start,next midnight). These are revision/instant comparisons, not SQL item-expiry arithmetic. A changed source, newly completed scoped result or midnight crossing returns date_context_stale for reread/Python recomputation. It must not commit an expired result from an earlier day. No network/provider call or Python callback runs inside the RPC, and no derived expiry is persisted. Retry output is rebuilt at read time. This refines existing command validation, not the architecture or lifecycle.

## Deterministic FEFO and attention ordering

Scope: received, not fully distributed lots in the target association only. Stock derives from actual immutable receipt/distribution movements; refused/booked/unreceived attempts never enter FEFO. Expose fefo_group and distribution_restriction per lot. Sort with this total key:

1. Group 0 dated: reliable effective date, no strict restriction. Sort by effective_expiry_date ascending, then receipt.created_at UTC ascending, then donation UUID lexicographically. Passed DDM can appear first with its warning/required acknowledgement.
2. Group 1 unknown: no reliable date and no unresolved strict restriction. FIFO by receipt time, then donation UUID; visibly "date review needed", never a fabricated FEFO date.
3. Group 2 not_applicable: FIFO by receipt time, then donation UUID.
4. Group 3 blocked: strict date passed/unresolved or opened-food restriction. Sort by known strict effective date ascending with nulls last, then receipt time and UUID. Clearly separate "cannot distribute/clarify"; it is not a distribution recommendation.

Unknown and not-applicable items are retained, not lost from inventory/counts. A user can filter attention/blocked lots; the ordering does not change item/offer/booking states. All distribution commands still check the current restriction and acknowledgements even if a stale list placed an item in another group. FEFO ordering and group numbers are Python read-time values, never stored ranks/counters.

## Assumptions and limits

Version expiry-v1 is the chosen proposed policy for this 40-hour design; it replaces generic policy_required for these cases. Operational policy_version=mvp-domain-v1 remains separate. Policy revisions need versioned fixtures and consistent contracts, not mutations of source facts or originals. Stock is kept in its received packaging/state until full distribution; opening/repacking or post-receipt source-date correction is outside the existing MVP. A frozen unopened fact is not proof of present physical condition: staff must not confirm distribution if the item no longer matches it. Association-specific thresholds/custom expiry-policy UI, food post-opening arithmetic, nutritional/clinical suitability, partial-date ML disambiguation and jurisdiction-specific compliance engines are outside MVP. Staff retain responsibility for actual intake suitability; remaining deployment/retention/upload limits stay in the AMB register. The core date behavior is now explicit, not left for an LLM or frontend implementer to invent.
