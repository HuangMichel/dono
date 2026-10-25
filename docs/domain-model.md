# Dono domain model and working MVP defaults

Status: **implemented backend domain baseline**; live Supabase/OpenAI verification remains in [readiness](readiness.md). This document replaces the earlier one-donation/one-target proposal. [AGENTS.md](../AGENTS.md) retains its six binding rules. [Requirements](requirements.md), [features](features.md), [schema](databases.md) and [FastAPI API](api.md) implement the same model on paper. Policy version: `mvp-domain-v1`.

## Why the six review findings matter

The review is justified. The earlier design made refusal terminal for an item, overloaded one quantity budget, left holds without release rules, used one combined status enum, deferred essential membership provisioning, and could retain a valid late analysis while leaving the item without a required basis. Merely marking these gaps open would not produce an implementable model. The correction separates the entities and supplies explicit working defaults below. Product owners may change those defaults, but any change must update constraints, API guards, tests and diagrams together; it is not permission to leave the mechanisms undefined.

AI originals were already logically separate from corrections. That invariant is retained; the merge, fallback and historical access rules are now complete. No provider becomes a decision maker and no transport or messaging service is introduced.

## Entity responsibilities

| Concept | Owns | Does not own |
|---|---|---|
| Donation | Stable donor-owned item ID; current category, attributes, quantity, source dates, photos, facts origin/version and item disposition. | Target association, staff decision, booking or a refusal status. |
| Donation offer | One attempt at one association/need, frozen item/evidence snapshots, human decision, finite review/booking deadlines and attempt history. | Reusable item identity or future donor corrections. |
| Need | Requested item quantity, matching criteria, seasonal availability and a staff-declared storage rate per item. | Available physical space or daily processing throughput. |
| Capacity | Per-category storage ceiling in administrative storage places. | Demand or number of daily arrivals. |
| Intake quota | Category/day throughput ceiling in item units. | Storage occupancy or appointment count. |
| Slot / booking | Configured appointment places / one actual appointment for an approved offer, dated quota allocation, signed QR and terminal outcome. | Human approval or physical stock before reception. |
| Inventory movement | Actual full receipt or full distribution, with actor and source offer/booking. | Pending reservations or speculative arrivals. |
| AI result / correction | Immutable original analysis / separate current human facts and item change journal. | Approval/refusal or operational arithmetic. |

Relationships: one donation has many historical offers, at most one active offer, and many historical bookings through those offers. One offer has at most one booking in this MVP; cancellation ends that attempt, so rescheduling means a fresh offer/review/booking. A donation has at most one physical full receipt over all attempts, followed by one full distribution. No splitting, partial receipt/distribution or post-receipt return is required for the 40-hour build.

## Working defaults

These are **proposed product defaults for implementation**, explicitly chosen for the reviewed MVP; they are not pre-existing user facts or measured estimates. Core guards use them consistently instead of returning policy_required for the six reviewed gaps. Remaining unrelated questions are listed separately.

| ID | Working default | Rationale / boundary |
|---|---|---|
| DEC-001 | Donation states: draft, ready, withdrawn, transferred. Offers and bookings have independent states. One pending_review/approved offer at a time. | Re-offer the same item after an unreceived attempt closes; never overwrite the previous target or decision. |
| DEC-002 | Review deadline 72 elapsed hours after submission. Human approval permits booking for 24 elapsed hours. | Pending offers reserve no resources; unbooked approval holds cannot remain indefinitely. No deadline extension endpoint in MVP. |
| DEC-003 | Book only a future slot starting within seven elapsed days of booking time. Receipt window is [slot start, slot end + 30 minutes). | Booking replaces the 24-hour cutoff with a bounded reception deadline. At the cutoff, booked becomes no_show and the offer expires. No early/late override. |
| DEC-004 | Demand/intake use positive integral item quantities. Storage uses item_slot places and a positive integer storage_units_per_item declared by staff per need. | Matching independently checks quantity demand, quantity × rate storage and dated quota; no kg/volume conversion or model estimation. |
| DEC-005 | Approval holds demand + storage. Booking also holds one slot place + dated intake quantity. Full receipt converts holds to fulfilled demand, consumed daily quota and actual stock. | Cancellation/expiry/no-show releases unreceived holds. Distribution releases storage only; it never recreates demand or daily quota. |
| DEC-006 | Freeze facts/photos/new analysis requests while an offer is active. In-flight results may finish. A complete human-entered item with validated photos may be offered without a successful AI result. | Show pending/unavailable analysis explicitly; staff approval then requires manual-review acknowledgement plus intake assertions. A basis is never required for valid manual facts. |
| DEC-007 | First successful result attaches a comparison basis if missing. Seed working facts only if the working set is empty, the captured facts_revision is current and no active offer exists. | Attaching evidence and seeding facts are separate actions. Any human input wins; later results never replace it or an existing basis. |
| DEC-008 | Supabase Google OAuth is the working sign-in default; first application profile is provisioned from the verified Auth subject with donor capability only. | No SMTP, email invitations, magic links or app email verification dependency. Provider credentials/redirect setup are deployment prerequisites, not implemented here. |
| DEC-009 | Association-local IANA timezone is required, with Europe/Paris as the demo default. Season uses calendar months: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter. Empty need.seasons means unrestricted; otherwise current season must match. Distance orders eligible results nearest first, then association ID and need ID; no distance cutoff in MVP. | Operational clocks are UTC instants. Donor origin is request-scoped and not retained; distance is ranking, not a later approval constraint. No model, weights or routes. |
| DEC-010 | Admins alone configure needs/storage/quotas/hours/slots and manage members. Admin/staff both review, receive and distribute. | Bootstrap, last-admin protection, role transfer/revocation and limited platform recovery are defined below. No self-assigned roles. |
| DEC-011 | One intake site per association/legal entity in MVP, with at least one normalized RNA/SIRET, syntactic checks and manual platform verification. | Duplicate identifiers are rejected. Automatic registry verification and multi-site support remain post-MVP. |
| DEC-012 | No active overlapping slots at one association. Slot interval must fit configured hours and one local date. Freeze booked address/hours; freeze timezone after any slot exists. | Cancel affected bookings before changing operational context; deactivate unused slots that no longer fit hours. Historical bookings retain address/timezone snapshots. |
| DEC-013 | analysis-v1 defines five closed category contracts, confidence/null/indicator bands and manual clarification; originals never change after donor edits. | See analysis-rules.md; no model approval or measured accuracy claim. |
| DEC-014 | expiry-v1 defines exclusive buckets, source-date/PAO handling, strict-date/DDM checks and total FEFO using Python read-time calculations. | See expiry-rules.md; no stored expiry/rank or lifecycle change. |

Store operational lease/QR deadlines and source snapshots, computed by deterministic code. They are not product shelf-life derivatives. Never store item days_left, expired flags, expiry buckets, effective PAO expiry or FEFO rank. Those remain read-time calculations under BR-002.

## State machines and recovery

| Aggregate | Allowed transitions | Guard / result |
|---|---|---|
| Donation | draft → ready; ready → withdrawn; withdrawn → ready; ready → transferred | Owner publishes/restores validated facts; owner withdrawal closes any live attempt and booking atomically. Only actual staff reception transfers the item. No return from transferred in MVP. |
| Offer | pending_review → approved or refused; pending_review → withdrawn or expired | Only personnel set the decision; donor withdraws; code expires at review_deadline. Refusal ends this attempt, not the donation. |
| Offer | approved → fulfilled, withdrawn, cancelled or expired | Receipt fulfills; owner withdrawal or authorized cancellation closes it; code expires unbooked hold or booked no-show. Preserve original approved decision/actor/time. |
| Booking | booked → received, cancelled or no_show | Target personnel explicitly receive within the window; owner/personnel cancel before physical receipt; code marks no-show at cutoff. All terminal states invalidate QR reception. |
| Inventory | unreceived → in_stock → distributed | Derived from immutable actual movements, not a shared persisted status. At most one full receipt and one full distribution per donation. |

Refused/withdrawn/cancelled/expired offers are terminal historical attempts. If the donation is still ready, its owner can correct it and create a new offer to the same or another association. Donor withdrawal of the item leaves it withdrawn until explicit restore. A cancelled/no-show booking always closes its offer; a fresh attempt requires fresh human review and all current resource checks. There is no booking cancellation that leaves a hidden indefinite approval hold.

Staff may cancel an approved attempt with a reason when intake becomes impossible, including a physical mismatch before receipt. That is a cancellation of an earlier human approval, not rewriting it as a refusal. No retrospective decision editing, partial delivery, reversal, stock return or automatic AI decision is added. For camera failure, staff may type the same signed QR payload/scan string into the authenticated resolve flow; possession alone grants no authority and no unsigned booking-ID bypass exists.

History is preserved by retained offer rows and immutable snapshots, append-only offer_events, one-way booking terminal metadata, item disposition/fact changes in donation_edits, membership_events and actual inventory movements. System expiry events record both the effective cutoff and later recorded_at time. Code expiry is operational timeout language, never “AI refused”.

## Independent accounting and matching

Use one database-clock reference after locks for each command. An approved offer has a live hold only while its item remains ready and either: it has no booking and now < approval_deadline; or its booking is booked and now < receivable_until. A fulfilled/cancelled/withdrawn/refused/expired attempt has no reservation. Pending review has none.

| Budget | Read-time used amount | Availability |
|---|---|---|
| Need item demand | Live approved offer quantities + quantities actually received for that need. | target_quantity − held − fulfilled. |
| Physical storage | Sum(live offer quantity × frozen approval storage rate) + Sum(remaining received lot quantity × its frozen rate). | limit_storage_units − reserved places − occupied places. |
| Daily category intake | Live booked quantities for this quota date + quantities actually received against that date. | limit_quantity − booked − received. |
| Appointment places | Live booked appointments + received appointments for that slot. | max_bookings − booked count − received count. |

No stored balance counters. All four ceilings must remain nonnegative; reducing configuration below committed usage is rejected. Distribution releases physical storage, but received quantities remain fulfilled demand/consumed daily intake. No-show and cancellation release only reservations; they never delete an actual receipt. Missing capacity/quota/need/usable address configuration makes a candidate ineligible, not unlimited. Need deactivation or a season change stops new matching/submission/approval, but does not revoke an existing live approval/booking. Honour its frozen commitments until cancellation, cutoff or receipt; booking still checks its selected quota/place.

A deterministic match must satisfy active need/category/attributes/current-season demand, sufficient storage and at least one future slot with both appointment space and a dated quota sufficient for the entire lot within seven days. Matching is advisory and holds nothing. Recheck on submission/approval; booking rechecks its selected dated quota/place. Approval freezes the current staff-declared storage rate so a later rate edit cannot change historical holds or stock cost. Current eligibility for an already-approved offer's slot listing credits its own demand/storage hold rather than counting the same lot twice.

Example fixture: demand available = 10 items; storage available = 6 places; rate = 2 places/item; dated intake available = 2 items. A three-item lot fits demand and storage but fails intake; a one-item lot may match if a slot place is free. Increasing demand does not create storage or intake capacity.

## Expiry without a required scheduler

Do not put now() inside a partial unique-index predicate. The database enforces at most one physically pending_review/approved row per donation. Every replacement-offer command materializes any due active attempt under the item/parent locks before checking this index. Availability reads exclude elapsed holds immediately, even if no reconciliation job has changed the stored state yet. Expiry projections expose stored_state and effective_state separately.

Item-only fact/photo/analysis-start commands evaluate **effective** activity under the donation lock, so an elapsed stale offer does not prevent correction. They need not rewrite its stored state or take association locks. Budget-affecting/replacement/reconciliation commands take the full parent locks and materialize due states. Every booking/offer mutation also locks its donation, making the effective edit guard race-safe.

The association dashboard can call a bounded, idempotent reconciliation command to persist due expiration/no-show events. Normal successful mutations also reconcile affected rows. Reconciliation locks the same parents and uses the same guards as other commands; repeating it creates no extra history or release. No queue, worker fleet or cron is necessary for correctness. A process that never runs a cleanup job still cannot retain an effective reservation past the recorded cutoff. Failing business commands may roll back their incidental materialization; deadline-aware reads and successful replacement/reconciliation remain correct.

At a deadline equality, the hold is expired: valid intervals are half-open. A late receipt cannot revive a timed-out attempt or consume newly released capacity. Create a fresh offer and booking after revalidation instead. Tests must cover equality, idle cleanup, competing expiration/reception, cancellation/re-offer, double receipt and slot/quota contention.

## Registration and membership permissions

1. Supabase authenticates the person; FastAPI verifies the token. Create an application profile for its subject if absent, with donor platform_role only. Platform capability is separately provisioned by a trusted operator; neither OAuth metadata nor a profile PATCH assigns it.
2. Registration atomically creates a pending association with registered_by=caller, one inactive assoc_admin membership for that applicant, and a bootstrap membership event. No caller supplies an arbitrary initial admin ID. Pending registration grants no intake, matching or donation visibility. The applicant can read/fix their pending registration.
3. A platform operator manually checks identity/identifiers and approves the registration. The single approval transaction sets platform reviewer/time and activates the original applicant's admin membership with an event. It does not create donation approval or global data access. Failure rolls back both actions; retries activate once.
4. An active admin in that approved association can grant a role to an existing enabled profile UUID, change roles, revoke a membership or atomically transfer admin status. This is an in-app operation, with no email lookup/invitation channel. Profile UUID can be read by its owner from account/profile; a roster exposes UUID/role/activity only, not another user's private profile.
5. Cannot demote/revoke the last active enabled administrator. Transfer grants/enables the target admin and demotes the initiating admin to staff atomically. Every change increments membership revision and appends history. Staff cannot grant/revoke/configure.
6. Narrow platform recovery is allowed only when an approved association has **no active enabled admin**: after manual verification, reactivate its original registered_by applicant, with mandatory reason and a recovery event. No arbitrary target, self-assignment or donation read accompanies platform recovery. Other account-access recovery remains with the Auth provider/trusted operator runbook; no app messaging is added.
7. Revoke by setting active=false, not deleting. Permissions read current database membership/disabled status, not stale role claims. Membership writes and business commands serialize through the association mutex and membership row locks; after revocation commits, later commands and idempotency replays are denied. In-flight commands that already committed before revocation remain historical facts.

## Corrections, delayed results and historical privacy

Current donation facts and source dates are donor-owned. Any human values on creation/edit mark facts_origin=human. An analysis captures immutable photos/digests, request identity and facts_revision, then runs outside database locks. On completion, append original extraction/indicators. Attach a missing comparison basis independently from seeding. Only seed a still-empty, unchanged, inactive-offer working set; never overwrite even one human fact. A result cannot set item/offer/booking/inventory state or a human decision.

Publish/offer accepts complete validated human facts and valid photos even with pending/failed/no AI result. It displays that condition, missing confidence and any category mismatch. Staff see unavailable/pending evidence and must explicitly acknowledge manual review before approving without usable indicators, in addition to medicine/food checks. Failed output creates no successful analysis row. Original category/indicator warning history never disappears when a donor changes category. New analysis requests while an offer is live require withdrawal first; already registered in-flight requests can finish.

Submission freezes source facts, photo IDs/digests, relevant existing analysis-request IDs (including in-flight requests) and correction IDs in an evidence scope. Staff can read only the immutable evidence in their association's offer scope, including the eventual result of a request already captured there. They cannot read the raw current donation/expiry_info or later corrections/new requests belonging to another attempt. After re-offering to B, A retains its own snapshot/history while B receives the new snapshot; neither gets the other's attempt. Raw donor location is not retained. RLS and photo content handlers must enforce these scopes directly, not rely on frontend filtering.

Late evidence may append a warning to the scoped evidence display but does not retroactively change an existing staff decision, item facts or booked resources. Before a new approval, guards read currently available scoped evidence. After a decision, new evidence is highlighted in-app for personnel; only a new explicit authorized action can cancel an unreceived attempt. Confirmed medicine/chilled-food exclusions remain mandatory regardless of any category label or missing AI.

## Remaining product decisions

The six structural defaults remain unchanged. The two analysis/expiry blockers now have explicit [analysis-v1](analysis-rules.md) and [expiry-v1](expiry-rules.md) defaults, plus [future test cases](rules-test-cases.md). These include category schema/uncertainty/safety bands, exclusive date boundaries, partial-date/PAO normalization, strict-date versus DDM checks and deterministic FEFO. Upload limits, retention, device/model/resource budgets and advanced metrics remain open. No runtime tests or calibration claims follow from this specification.

## Photo persistence decision — database base64

The user explicitly replaces the previous file-store design: Supabase supplies Auth and Postgres, with **no Supabase Storage dependency**. donation_photos contains immutable metadata/digests; private.photo_contents contains one canonical RFC 4648 image_base64 text per accepted photo. One transaction writes metadata, content, item facts revision and retry result references; there is no bucket path or distributed file/database commit.

FastAPI receives multipart files, validates decoded bytes/type/size/count, encodes base64, then commits. Its existing authenticated content endpoint rechecks owner/offer-evidence scope, reads the private payload, decodes and returns binary. Lists, evidence snapshots, audit/retry records and ordinary table reads never carry image_base64. Immutable photo IDs/digests and recipient whitelists continue to identify exactly the same accepted bytes. Upload limits cover decoded and encoded size; thresholds and retention remain AMB-003/015. See [database details](databases.md#photo-storage).

## Analysis and expiry policy defaults

DEC-013: analysis-v1 fixes the five closed extraction contracts, category confidence ≥0.80 for optional untouched-fact seeding, indicator levels at 0.50/0.80, null/conflict/manual fallback behavior and permanent original provenance. confidence is category probability, never approval or OCR-wide certainty. The existing analysis_unavailable_ack flag covers unavailable, uncertain, mismatched or unassessable evidence; its historical name does not mean every such original is a failed run.

DEC-014: expiry-v1 uses one exclusive bucket, today not expired, a separate exactly-90 bucket, explicit partial-date/PAO rules and stable FEFO groups. Known strict passed/unresolved dates prevent physical commands without automatically refusing/cancelling an offer. DDM requires date-specific human review when passed/unknown. Source facts/current scoped evidence and database-clock day fences prevent stale Python calculations from committing. Operational mvp-domain-v1 remains distinct; no stored item-expiry derivatives or lifecycle changes.
