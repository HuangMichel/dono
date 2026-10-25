# Analysis and expiry acceptance fixtures

Status: **acceptance scenario specification**. A backend pytest suite now exists; [readiness](readiness.md) records executed tests. The real photo evaluation set remains absent, and scenario IDs here are not a claim that every scenario has a dedicated passing test. IDs below describe expected behavior under [analysis-v1](analysis-rules.md) and [expiry-v1](expiry-rules.md). Use injected provider payloads/reference instants for deterministic tests; live model scores are not exact test oracles.

## Analysis schema and provenance tests

| ID | Input / scenario | Expected result | Trace |
|---|---|---|---|
| AN-T001 | One valid payload for each of the five category branches | All required model keys, correct enums, exactly common+category indicators; persist original once. | FR-008/009; UC-004 |
| AN-T002 | Unobserved size/brand/condition and missing label | Null facts; key-only unknown indicators; no fabricated zero or confidence row. | FR-008/009; UC-004 |
| AN-T003 | Probability -0.01, 1.01, NaN/infinity; duplicate/unknown/missing indicator key; unknown attribute; sixth category | Invalid analysis, no successful original; explicit error/manual fallback. | FR-008; UC-004 |
| AN-T004 | p=0, .4999, .5, .7999, .8, 1 | Levels low, low, medium, medium, high, high, computed in Python without modifying p. | FR-009; UC-004 |
| AN-T005 | confidence=.7999 versus .8, valid class distribution and empty unchanged facts | First result retained but not seeded at .7999; eligible to seed at .8 only under existing empty/revision/no-offer guard. | FR-010/038; UC-005/015 |
| AN-T006 | Looks_like_medicine=.8; donor changes para→clothes | Original/category/probability unchanged, pharmacy warning retained; staff must clarify and explicitly assert not_medicine with reason; confirmed medicine never proceeds. | BR-001/004; UC-004/005/008 |
| AN-T007 | Food cold-storage=.5; no label; manual complete item | Visible concern; no AI decision. Staff clarify eligibility/reason; unknown evidence needs manual acknowledgement. Confirmed chilled/frozen remains excluded. | BR-005; UC-004/008 |
| AN-T008 | Food storage_condition null or non_perishable null | No automatic true seeding/publication shortcut; donor must supply required source facts. | FR-008/015; UC-004/007 |
| AN-T009 | Class vector (.5,.5,0,0,0), category clothes, confidence=.5 | Original valid uncertain tie; explicit donor category choice, no seed. Shoes wins neither by provider preference nor human category hint. | FR-008/010; UC-004/005 |
| AN-T010 | Class sum outside inclusive 0.01 tolerance (0.99/1.01 remain valid), nonmaximal selected category or confidence differs from its probability | Reject as invalid analysis, not silently renormalize or repair a probability. | FR-008; UC-004 |
| AN-T011 | pair_complete=true with pair_incomplete=.9; conflicting absolute labels | Original valid evidence retained with evidence_conflict; no automatic seed; date conflict remains unknown. | FR-008/011/038; UC-004/005 |
| AN-T012 | Provider timeout/refusal/incomplete JSON, then valid human form | Unavailable, no synthetic success/zero confidence; publication/manual review may proceed with required facts/acknowledgements. | FR-008/038; UC-004/008/015 |
| AN-T013 | First result returns after donor correction or active offer | Append once, attach missing basis separately; no human/snapshot/decision/hold overwrite, same request fence/scope. | FR-011/038; UC-005/015 |
| AN-T014 | Second run disagrees; human override/reanalysis | Both originals retain provenance; current human facts drive matching; no probability fusion/relabeling. | FR-010/011; UC-005 |
| AN-T015 | Model supplies opened_on, computed expiry/bucket, estimated dimensions or inferred quantity | Reject unsupported fields; Python/human source paths only. | BR-002; UC-004/009 |
| AN-T016 | Arbitrary corrected category attrs, invalid quantity or attempt to PATCH original probability | Closed input validation/permission denial; originals immutable. | FR-010/011; UC-005 |

## Expiry boundary fixtures

Use reference_date=2026-10-25, timezone=Europe/Paris and explicit as_of=2026-10-25T12:00:00Z, unless stated. Exact source dates have reliable type DDM, precision day and readable source. expired here means date passed, not unsafe.

| ID | Source date / d | Expected bucket | expired |
|---|---|---|---|
| EX-T001 | 2026-10-24 / -1 | expired | true |
| EX-T002 | 2026-10-25 / 0 | today | false |
| EX-T003 | 2026-10-26 / 1 | lt_7 | false |
| EX-T004 | 2026-10-31 / 6 | lt_7 | false |
| EX-T005 | 2026-11-01 / 7 | lt_30 | false |
| EX-T006 | 2026-11-23 / 29 | lt_30 | false |
| EX-T007 | 2026-11-24 / 30 | lt_90 | false |
| EX-T008 | 2027-01-22 / 89 | lt_90 | false |
| EX-T009 | 2027-01-23 / 90 | at_90 | false |
| EX-T010 | 2027-01-24 / 91 | gt_90 | false |

## Source, PAO, safety and ordering fixtures

| ID | Input / scenario | Expected result | Trace |
|---|---|---|---|
| EX-T011 | Missing food label vs supplied unreadable label | unknown/missing_date versus unknown/unreadable_date; date/days/expired null. | FR-018/019; UC-009 |
| EX-T012 | 03/04/2026 without confirmed format, missing year, two-digit year, two conflicting labels | Unknown with specific reason; no locale/current-year/century/earliest-label guess. | FR-018/019; UC-004/009 |
| EX-T013 | Human ISO 2026-02-30; provider impossible exact ISO | Human 422 / invalid analysis respectively; no source mutation/success row. | FR-008/018; UC-004/005 |
| EX-T014 | DDM 02/2024, month precision | Computed 2024-02-29; source expiry_date stays null and raw text unchanged. | FR-018/019; UC-009 |
| EX-T015 | DDM 2026, year precision | Computed 2026-12-31; no persisted derived day. | FR-018/019; UC-009 |
| EX-T016 | Same partial 02/2024 labeled DLC | Unknown/incomplete_strict_date; no month-end extrapolation; clarify before approval. | FR-018/019; UC-008/009 |
| EX-T017 | Para expiry 02/2024, month precision; year-only 2026 | First computes month end; year-only remains unknown. | FR-018/019; UC-009 |
| EX-T018 | PAO 12, confirmed unopened, no absolute date | not_applicable, basis pao_unopened; no countdown from upload. | FR-018/019; UC-009 |
| EX-T019 | PAO 12, opening state unknown; opened with no/future date | unknown with correct opening-state/date reason, clarification guard; no invented start. | FR-018/019; UC-008/009 |
| EX-T020 | Opened 2026-01-31 +1 month; 2024-01-31 +1; 2024-02-29 +12 | 2026-02-28; 2024-02-29; 2025-02-28, read-time only. | BR-002; FR-019; UC-009 |
| EX-T021 | Opened 2026-01-31, PAO=1, as_of target Feb 28 / Mar 1 | today,false on Feb 28; expired,true on Mar 1. | FR-019; UC-009 |
| EX-T022 | Absolute 2026-12-31 plus PAO expiry 2026-11-01 | Effective Nov 1 once; no duplicate bucket/count. Unknown PAO start instead makes overall expiry unknown, without erasing a separately passed absolute restriction. | FR-019/020; UC-009 |
| EX-T023 | Same strict date yesterday vs today | Yesterday command blocked without setting decision; today date guard alone passes, other eligibility/QR/role checks still required. | FR-017/024; UC-008/011 |
| EX-T024 | Passed DDM with/without acknowledgement and human reason | Warning retained; no automatic unsafe/refused label. Physical commands require current explicit acknowledgement/reason; passing it never bypasses other restrictions. | FR-017/022; UC-008/012 |
| EX-T025 | Ordinary undated clothes versus food with missing date | not_applicable versus unknown, distinct counts; neither gets days_left=0. | FR-019/020; UC-009 |
| EX-T026 | Opened food with printed future DDM | unknown/opened_food and intake restriction; do not invent post-opening duration. | BR-005; FR-019; UC-008/009 |
| EX-T027 | Several dated stock lots, same date, differing receipt times/UUIDs; unknown/NA/blocked lots | Exact total FEFO group/date/time/UUID order in expiry-v1; stable ties, blocked group separate, no unreceived or distributed lot. | FR-020; UC-009 |
| EX-T028 | Date/group/bucket counts joined to multiple analyses/closed offers | One count per actual undistributed receipt/item; sum of nine buckets equals scoped lot count. | FR-020/021; UC-009 |
| EX-T029 | Paris midnight and UTC reference mismatch, DST transition | Local calendar reference and days correct, independent of elapsed-hour length. 2026-10-24T22:30Z is Oct 25 Paris; 2026-10-25T23:30Z is Oct 26 Paris. | FR-019; UC-009 |
| EX-T030 | Booking slot day later than known strict date; grace crosses local midnight | Exclude later slot; reception after strict date fails even with otherwise-valid QR/window. No automatic cancellation or decision rewrite. | FR-023/024; UC-010/011 |
| EX-T031 | Frozen offer date versus later donor correction to another attempt | Each recipient computes only its frozen source; no future-fact disclosure and no original mutation. | FR-011/018; UC-005/015 |
| EX-T032 | Python guard computed before midnight/source change, command acquires locks afterward | date_context_stale; reread/recompute, no physical effect from stale result. New scoped analysis completion also invalidates evidence fence. | NFR-004; UC-008/011/012 |
| EX-T033 | Replay/read next local day with same source IDs | Reauthorize and recompute date/bucket/restrictions from current reference, no cached expiry/rank. An expiry cursor from the previous local day returns stale_cursor; Python global ordering precedes pagination. | BR-002; NFR-004; UC-009 |

A future property test should cover every integer d from -365 through 3650: exactly one date bucket and correct expired relation; unknown/NA are disjoint. Other dates use valid proleptic Gregorian dates supported by Python/Postgres, never a synthetic far-future sentinel. No model is called for deterministic fixture arithmetic or expected FEFO order.

## Photo evaluation plan

Prepare **30 unique consented/synthetic images**, within the existing 25–35-image target: five primary images per category (25) plus five auxiliary close-up/cross-category/classification-conflict images. A fixture case may pair an appropriate primary image with an existing auxiliary image; that does not add files beyond the 30-image set. Include medicines disguised as para/food, chilled/frozen labels, stains/holes/pilling, shoe pair/sole damage, furniture damage/mould, sealed/unsealed hygiene, unreadable/partial/ambiguous dates and PAO with no opening information. A case may contain the permitted label close-up once AMB-003 fixes attachment limits.

Record category/visible-source facts, observable indicators, uncertainty and expected warning behavior with human annotations. Do not use approve/refuse as a ground-truth indicator label; do not require a live model to return an exact invented probability. Use fixed synthetic payloads for threshold/schema/provenance tests and separately inspect real provider outputs for honest uncertainty and false negatives/positives. No empirical accuracy/calibration target is claimed before that evaluation.

Future tools remain backend pytest and frontend contract/UI tests after scaffolding, with real Postgres/RLS integration for immutable originals and guarded command races. This document does not install a runner or claim these tests passed.


## Additional implementation regression

EX-T034: false strict-label correction requires `date_label_correction_confirmed`, nonempty reason and human-confirmed snapshot facts; missing confirmation fails. A corrected current expired/unresolved strict date still fails. Booking reuse fails when completed evidence IDs change. Original AI rows remain immutable. Covered by backend rule-edge and database history tests; hosted/provider evaluation remains separate.
