# Implementation handoff

## Current state and authority

The FastAPI backend, Supabase migration set and OpenAI integration are implemented. No frontend was scaffolded and no hosted project was modified. [AGENTS.md](../AGENTS.md) remains authoritative; its six product rules are unchanged. [Readiness](readiness.md) records measured checks and remaining release gates. The [architecture index](architecture.md) links all preserved interactive diagrams and native sources; their existing validation receipts are diagram evidence, not backend test evidence.

The implementation includes all 64 documented REST method/path combinations, explicit Pydantic response contracts, verified Auth identity, fresh database permissions/RLS, immutable AI evidence, base64 photo persistence, deterministic expiry/matching, reusable donations and historical offers, independent resource budgets, finite holds, booking and signed QR reception, full-lot inventory, membership administration, site configuration and bounded expiration reconciliation. Source: [backend](../backend/), [migrations](../supabase/migrations/), [API](api.md), [database dictionary](databases.md).

## Decisions retained

- [DEC-001–DEC-012](domain-model.md#working-defaults) provide the working MVP rules. Donation, offer, booking and inventory have separate lifecycles. One effective live offer per reusable donation; refusal permits a new attempt. No partial receipt/distribution, return, reversal or automatic decision.
- Demand, storage places, daily intake quantities and appointment places remain independent. Deadline-aware reads release expired unreceived holds without a scheduler; bounded reconciliation materializes history. Seven-day booking horizon means 168 elapsed hours, including DST transitions.
- Original AI extraction, indicators, provenance and input context remain immutable. Human fields are separate. A delayed result may attach missing original basis but cannot overwrite edits or expose a later recipient's evidence to an earlier association. Fenced retries and no network calls inside database transactions.
- User-approved upload defaults: JPEG/PNG/WebP, 5 MiB per image, three images, 20 megapixels; OpenAI timeout 60 seconds, analysis lease 120 seconds. Image payloads stay in private base64 PostgreSQL rows, never Supabase Storage.
- User-approved contract clarification: `date_label_correction_confirmed: true` requires a nonempty staff reason and frozen human-confirmed source facts. It addresses an incorrect original strict label, never an expired/unresolved strict date in corrected source facts. Approval audits reviewed analysis IDs. Booking may reuse that correction only while the completed evidence set is unchanged; reception/distribution require a fresh assertion and reason. Original evidence is never rewritten.
- Google OAuth remains the deployment sign-in choice, with no app email flow. Donor-only bootstrap; inactive original applicant admin; platform approval/activation; fresh membership checks, last-admin protection, transfer and narrow orphan recovery. Trusted operator provisions platform capability.
- Next.js is future presentation only. Python FastAPI owns business endpoints. OpenAI is the only implemented provider; Jev/hybrid follow the prescribed cut order. BAN via IGN uses longitude/latitude GeoJSON coordinates.

## Consistency resolutions

| Finding | Implemented resolution |
|---|---|
| Original model merged donation and offer | Dedicated offer rows, frozen facts/evidence, unique active attempt, separate human decision/history; re-offering retains item identity. |
| Capacity conflated with demand | Independent aggregate budgets, stable lock order and guarded atomic commands; no editable used counters. |
| Indefinite holds/lifecycle gaps | Finite deadlines, cancellation/withdrawal/restore/no-show/reconciliation, full-lot receipt/distribution and idempotent replay. |
| Undefined registration/admin rights | Atomic applicant approval, current membership/RLS, revocation/transfer/last-admin/orphan safeguards; no metadata-based elevation. |
| Late AI overwrote corrections | Original/basis attach separated from facts seeding; human revision fencing; recipient-frozen evidence scope. |
| Date-label correction had no API assertion | Explicit audited field above; current strict source restrictions still enforced in Python. |
| Applicant association read wording was broader than API scope | Applicant SELECT is pending-only, matching the API's G registration scope; approval requires active membership. |
| Old docs said no scaffold/commands | Setup and readiness now distinguish implemented local checks from hosted/model/mobile gates. |

## Evidence and limits

The test suite uses real disposable PostgreSQL with migrations, grants, RLS, transaction commands and parallel connections. Auth verification, the HTTP gateway, OpenAI and BAN are simulated in integration tests. A separate public BAN sample lookup verified its response shape. No configured Google OAuth session, hosted Supabase deployment, real OpenAI call or photo-quality evaluation was performed. Synthetic image tests verify upload mechanics only.

Remaining decisions and risks:

- AMB-015: retention/deletion rules for base64 photos, originals and audit history remain unselected; no hard-delete policy is invented.
- AMB-018: optional Jev/hybrid semantics and evaluation remain deferred.
- AMB-019: deployment body/spooling limits, rate/model-cost budgets, memory/performance and target-mobile behavior need measurement/configuration. The endpoint limits decoded images, but multipart parsing precedes handler validation; deploy a request-size limit.
- Choose an OpenAI model and confirm its support for all five strict schemas. Complete the required 25–35 real-photo evaluation including medicines/para. Do not infer accuracy from mocked responses.
- Apply migrations to an isolated managed Supabase development target and verify owner/grant compatibility, Auth Google redirects, restricted RPC and private schema exposure. Full Docker stack startup was unavailable in this environment. Run current Supabase security/performance advisors there.
- Deployment topology, HTTPS and secret provisioning/rotation remain operational work. QR payload generation is implemented; graphical QR rendering/scanning belongs to the future frontend. No live/demo user accounts or production seed were provisioned.

## Recommended implementation milestones

1. Validate migrations and Auth/RLS against the chosen Supabase development project; provision trusted operator and demo data. Run the full automated backend checks.
2. Select/configure OpenAI; run live category-schema smoke tests and the real-photo acceptance set. Confirm upload/retention/cost limits.
3. Build the Next.js client against the implemented contracts: donor/manual corrections, review queue, bookings/QR display/scanning, expiry/FEFO and membership/configuration. Preserve human-only decisions and original-indicator provenance in every UI.
4. Exercise complete mobile donor→staff→receipt→distribution flows with competing resource requests, revocation, time boundaries and delayed AI. Measure public deployment limits before launch.

Stay within the 40-hour MVP: no transport, routes, pickups, messaging, email, Jev comparison, partial inventory or extra analytics before the required flows work.
