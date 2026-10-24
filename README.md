# Dono

**Scan before you donate.** Dono helps individuals offer usable goods to associations that need them and have space. AI supplies indicators; association personnel make the donation decision.

This repository is a **pre-implementation design baseline** for a hackathon MVP with a total effort budget of **40 hours**. It contains specifications and interactive diagrams. There is no application scaffold, frontend/package.json, backend/pyproject.toml, database migration, running API or photo evaluation set yet. Diagram validation does not verify application behavior.

## Product and scope

Associations spend time sorting unsuitable donations and managing limited storage. Dono supports a complete intake flow: validated donor photos + editable human facts → attributable AI evidence when available → deterministic matching → recipient offer → staff review → drop-off booking/QR → reception → stock/distribution. An item can be re-offered after refusal/cancellation/expiry; each attempt preserves its own history.

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
| Association staff | Review, reception and stock within active membership; admins alone configure intake/members. |
| Platform admin | Manual association approval and constrained orphan-admin recovery; no general donation access or donation decisions. |

Roles can coexist through a protected platform capability and association memberships under the proposed schema. The working Google OAuth/profile bootstrap, atomic applicant-admin activation, membership grants/transfer/revocation, last-admin protection and restricted recovery are defined in [domain-model.md](docs/domain-model.md).

## MVP priorities

Required: auth/RLS and manual association approval; needs form and editable free-text parsing; independent storage/daily intake quotas/hours/slots; validated photos and five analysis schemas; indicators and corrections; deterministic matching and offers; human review; booking/QR reception; light inventory/distribution; basic image gallery, expiry buckets/counts and distribute-first list.

Optional work is removed in this exact order: **Jev → OpenAI/Jev comparison → expiry timeline → AI/human agreement metric**. None is included in the base effort allocation. Advanced impact/financial/weight reporting and average shelf-life metrics are proposed for post-MVP in FR-030; any request to restore a measured counter needs the scope decision in AMB-020. Automated registration verification, maps and partnerships are later candidates. External channels and logistics require a separately authorized future scope.

The [working defaults](docs/domain-model.md#working-defaults) separate need demand, storage places, daily intake quantities and appointment places. Review lasts 72 hours, approval allows 24 hours to book, and reception ends 30 minutes after a slot; expired/cancelled unreceived holds are released even without a scheduler. Four distinct lifecycles avoid permanently refusing the reusable item. Full lots only, one active offer and one site per association keep the MVP bounded.

Human facts never depend on successful AI: valid manual facts/photos may proceed with explicit pending/unavailable evidence and staff review. Late results preserve originals and cannot overwrite corrections or a decision. Each association sees its own frozen offer evidence, not future corrections for another recipient. Analysis/indicator contracts and shelf-life boundaries/PAO/FEFO now have explicit [analysis-v1](docs/analysis-rules.md) and [expiry-v1](docs/expiry-rules.md) defaults with [future test cases](docs/rules-test-cases.md). Remaining upload, retention and operational budget decisions are listed in the [handoff](docs/handoff.md).

## Planned stack

| Layer | Technology / responsibility |
|---|---|
| Web application | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui; donor, association and approval views in one application. |
| REST backend | FastAPI (Python), Pydantic schemas and routers under `/api/v1`; Python services for analysis, matching, expiry and transactions. |
| Identity and data | Supabase Auth, Postgres with RLS; base64 photo content in a private table. No Supabase Storage. |
| Analysis | OpenAI vision and structured outputs; free-text needs produce a staff-confirmed draft. |
| Optional indicators | TypeSafe Jev / hybrid behind `ANALYSIS_PROVIDER`; Jev does no OCR/date/number extraction. |
| Geocoding | Government BAN address data through IGN Géoplateforme, `https://data.geopf.fr/geocodage/`. Backend geocoding only; no routing service. |

No dependency versions are selected. Next.js is the frontend; FastAPI is a separate Python backend. Check the future frontend/package.json and backend/pyproject.toml, pin compatible versions and commit both lockfiles; prefer releases at least seven days old.

## Documentation

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Binding product/security rules, provider contract and delivery gates. |
| [Requirements](docs/requirements.md) | Scope, actors, BR/FR/NFR IDs and open AMB decisions. |
| [Domain model](docs/domain-model.md) | Corrected entities, independent budgets, lifecycles, working defaults and recovery. |
| [Analysis rules](docs/analysis-rules.md) | Five closed extraction/indicator contracts, probabilities, uncertainty and immutable provenance. |
| [Expiry rules](docs/expiry-rules.md) | Exclusive buckets, source dates/PAO, Python date checks and deterministic FEFO. |
| [Rule test cases](docs/rules-test-cases.md) | 49 future analysis/date/FEFO scenarios; no implementation test claims. |
| [Features and use cases](docs/features.md) | Acceptance criteria, traceability and illustrative 40-hour allocation. |
| [Architecture](docs/architecture.md) | Components, interaction design and current Archify validation evidence. |
| [Database design](docs/databases.md) | Columns, constraints, RLS, locks, accounting and working domain constraints. |
| [REST API](docs/api.md) | Planned FastAPI endpoints, DTOs, permissions, errors and examples. |
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
| Donation item | [Reusable item](docs/architecture/donation-lifecycle.html) | [JSON](docs/architecture/donation-lifecycle.json) |
| Offer attempt | [Review, refusal and recovery](docs/architecture/offer-lifecycle.html) | [JSON](docs/architecture/offer-lifecycle.json) |
| Booking | [Appointment states](docs/architecture/booking-lifecycle.html) | [JSON](docs/architecture/booking-lifecycle.json) |
| Inventory | [Receipt and distribution](docs/architecture/inventory-lifecycle.html) | [JSON](docs/architecture/inventory-lifecycle.json) |
| Database | [Full ERD](docs/architecture/database-erd.html) | [JSON](docs/architecture/database-erd.json) |

The complete ERD uses a dense schema view; current validation/capture results and any layout advisories are recorded in architecture.md. Editable JSON sources and current evidence are kept alongside HTML and are no longer ignored. Historical captures do not prove revised artifacts.

## Design choices clarified

Closed vocabularies such as roles, unit, category and state use named PostgreSQL enums, with allowed values shown at each table column. Unit item, storage unit item_slot and calendar-season semantics form the proposed working MVP profile; new units require an explicit later design change. `attributes` holds validated item facts and need criteria, so it retains that name; technical provenance is separate. By the user's revised choice, Postgres stores base64 image text in private.photo_contents; donation_photos holds metadata/digests. Supabase Storage and bucket configuration are removed. Authenticated content routes decode and serve bytes; list DTOs contain no base64 payload. See the [database explanations](docs/databases.md).

The API uses `/api/v1/account/profile` and `/api/v1/account/memberships` for the signed-in user. All business routes belong to FastAPI; Next.js renders the frontend.

## Planned quickstart

Today you can read the documents and open the diagrams. Neither toolchain nor migrations exists. The root [.env.example](.env.example) separates public frontend settings from FastAPI-only secrets; populate the two future app environments selectively, never copy backend secrets into the frontend.

After scaffolding, package configuration, policy decisions and reviewed Supabase provisioning, the intended commands are:

```sh
# Future frontend/ directory only; not runnable in this repository today.
pnpm install
pnpm dev
```

```sh
# Future backend/ directory only; pyproject/app entry point do not exist yet.
uv sync
uv run uvicorn app.main:app --reload
```

The actual origins/ports and migration procedure will be documented after configuration. Planned frontend checks are pnpm lint/typecheck/test; planned backend checks are Ruff, mypy and pytest. None ran here. [Setup](docs/setup.md) lists prerequisites, environment boundaries and future RLS, concurrency, expiry and photo-set verification.
