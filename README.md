# Dono

**Scan before you donate.** Dono helps individuals offer usable goods to associations that need them and have space. AI supplies indicators; association personnel make the donation decision.

This repository is a **pre-implementation design baseline** for a hackathon MVP with a total effort budget of **40 hours**. It contains specifications and interactive diagrams. There is no application scaffold, `package.json`, database migration, running API or photo evaluation set yet. Diagram validation does not verify application behavior.

## Product and scope

Associations spend time sorting unsuitable donations and managing limited storage. Dono supports a complete intake flow: donor photos → AI evidence → donor corrections → deterministic matching → offer → staff review → drop-off booking and QR → reception → light stock and distribution.

The five categories are clothes, shoes, non-perishable room-temperature food, parapharmacy/hygiene and small furniture brought by the donor. Medicines cannot be donated; a high medicine indicator warns and points to a pharmacy. Chilled/frozen individual food is outside eligible scope.

[AGENTS.md](AGENTS.md) is authoritative. Its rules apply to every specification and future implementation:

- Only authorized association personnel approve or refuse a donation. AI returns extracted facts, indicators and confidence; its cards use indicator language.
- Donor category/attribute corrections remain separate from immutable original AI extraction and indicators. Display their provenance and any category mismatch.
- Code computes expiry, counts and distance. Days left, expired flags, buckets and FEFO are computed at read time and never stored.
- Matching uses need, capacity, season and Haversine distance deterministically, without a model.
- All status stays in the app. The MVP contains no transport, pickups, route optimization, email or messaging channels.

| Actor | Responsibility |
|---|---|
| Donor | Own photos, working facts/category, matching, offer, status and booking/QR. |
| Association admin | Own association configuration, review, reception and stock. |
| Association staff | Review, reception and stock within active membership; configuration rights remain open. |
| Platform admin | Manual association approval; no general donation access or donation decision rights. |

Roles can coexist through a protected platform capability and association memberships under the proposed schema. Exact onboarding, assignment and management permissions need decisions before implementation.

## MVP priorities

Required: auth/RLS and manual association approval; needs form and editable free-text parsing; capacity/hours/slots; validated photos and five analysis schemas; indicators and corrections; deterministic matching and offers; human review; booking/QR reception; light inventory/distribution; basic image gallery, expiry buckets/counts and distribute-first list.

Optional work is removed in this exact order: **Jev → OpenAI/Jev comparison → expiry timeline → AI/human agreement metric**. None is included in the base effort allocation. Advanced impact/financial/weight reporting and average shelf-life metrics are proposed for post-MVP in FR-030; any request to restore a measured counter needs the scope decision in AMB-020. Automated registration verification, maps and partnerships are later candidates. External channels and logistics require a separately authorized future scope.

Bucket boundaries, PAO, timezone, matching policy, capacity units/reservations, post-offer edits and booking exceptions remain explicit open decisions. The [handoff](docs/handoff.md) identifies which work each blocks; example values and DB-P01–DB-P07 are proposals, not agreed product defaults.

## Planned stack

| Layer | Technology / responsibility |
|---|---|
| Web application | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui; donor, association and approval views in one application. |
| REST backend | Next.js App Router Route Handlers under planned `/api/v1`; server modules for analysis, matching and expiry. |
| Identity and data | Supabase Auth, Postgres with RLS, private Storage for photos. |
| Analysis | OpenAI vision and structured outputs; free-text needs produce a staff-confirmed draft. |
| Optional indicators | TypeSafe Jev / hybrid behind `ANALYSIS_PROVIDER`; Jev does no OCR/date/number extraction. |
| Geocoding | API Adresse as named in AGENTS.md; resolve its current Géoplateforme endpoint before integration (AMB-021). No routing service. |

No dependency versions are selected. Check `package.json` when it exists, pin compatible versions and commit the lockfile; prefer releases at least seven days old.

## Documentation

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Binding product/security rules, provider contract and delivery gates. |
| [Requirements](docs/requirements.md) | Scope, actors, BR/FR/NFR IDs and open AMB decisions. |
| [Features and use cases](docs/features.md) | Acceptance criteria, traceability and illustrative 40-hour allocation. |
| [Architecture](docs/architecture.md) | Components, interaction design and current Archify validation evidence. |
| [Database design](docs/databases.md) | Columns, constraints, RLS, locks, accounting and provisional schema choices. |
| [REST API](docs/api.md) | Planned Next.js endpoints, DTOs, permissions, errors and examples. |
| [Setup](docs/setup.md) | Prerequisites, planned Supabase configuration, environment and future checks. |
| [Handoff and audit](docs/handoff.md) | Decisions, contradictions, assumptions, blockers, milestones and risks. |
| [Readiness report](docs/readiness.md) | Review outcome, changed files, verified design invariants and implementation order. |

## Interactive diagrams

Open the standalone HTML files in a browser. Sources and current receipts/captures are linked in [architecture.md](docs/architecture.md#interactive-diagrams).

| Diagram | HTML | Editable source |
|---|---|---|
| System | [Architecture](docs/architecture/dono-architecture.html) | [JSON](docs/architecture/candidate.json) |
| Actors / use cases | [Use cases](docs/architecture/use-cases.html) | [JSON](docs/architecture/use-cases.json) |
| Donation creation | [Photo, analysis and corrections](docs/architecture/donation-creation.html) | [JSON](docs/architecture/donation-creation.json) |
| Matching / review | [Matching and human decision](docs/architecture/matching-review.html) | [JSON](docs/architecture/matching-review.json) |
| Booking / reception | [Booking and QR](docs/architecture/booking-reception.html) | [JSON](docs/architecture/booking-reception.json) |
| Lifecycle | [States and guards](docs/architecture/donation-lifecycle.html) | [JSON](docs/architecture/donation-lifecycle.json) |
| Database | [Full ERD](docs/architecture/database-erd.html) | [JSON](docs/architecture/database-erd.json) |

The ERD retains its documented dense-layout warnings. All existing sources, HTML, receipts and captures are preserved by this review.

## Planned quickstart

Today you can read the documents and open the diagrams. Copying [.env.example](.env.example) to an ignored `.env.local` prepares placeholders only; it does not create a runnable application.

After policy decisions, scaffolding, package scripts, reviewed migrations and seed data exist, the intended local sequence is:

```sh
# Future workflow only; package.json and these scripts do not exist yet.
pnpm install
cp .env.example .env.local  # only if absent; fill approved settings locally
# Provision the selected Supabase environment using the future migration runbook.
pnpm dev
```

The dev URL will be documented after configuration. Planned checks are `pnpm lint`, `pnpm typecheck` and `pnpm test`; none can run in the current repository. [Setup](docs/setup.md) separates preparation from future commands and lists the required RLS, concurrency, expiry and photo-set verification.
