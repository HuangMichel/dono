# Dono

**Scan before you donate.** Dono helps individuals offer usable goods to associations that need them and have space. AI supplies indicators; association personnel make the donation decision.

This repository now includes a FastAPI backend, Supabase PostgreSQL migrations/RLS and OpenAI Structured Outputs integration. All 64 documented REST method/path combinations are registered. The Next.js frontend in [frontend/](frontend/) is a browser-local demo and is not connected to the backend yet. The merge preserves both implementations; [contract differences](docs/requirements.md#backend-integration-differences) need resolution before API wiring. The total product scope remains a **40-hour hackathon MVP**; [readiness](docs/readiness.md) distinguishes executed backend checks from remaining live-provider and photo-evaluation gates.

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

Human facts never depend on successful AI: valid manual facts/photos may proceed with explicit pending/unavailable evidence and staff review. Late results preserve originals and cannot overwrite corrections or a decision. Each association sees its own frozen offer evidence, not future corrections for another recipient. Analysis/indicator contracts and shelf-life boundaries/PAO/FEFO now have explicit [analysis-v1](docs/analysis-rules.md) and [expiry-v1](docs/expiry-rules.md) defaults with [rule test cases](docs/rules-test-cases.md). Approved upload limits and remaining retention/operational budget decisions are listed in the [handoff](docs/handoff.md).

## Planned stack

| Layer | Technology / responsibility |
|---|---|
| Web application | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui; donor, association and approval views in one application. |
| REST backend | FastAPI (Python), Pydantic schemas and routers under `/api/v1`; Python services for analysis, matching, expiry and transactions. |
| Identity and data | Supabase Auth, Postgres with RLS; base64 photo content in a private table. No Supabase Storage. |
| Analysis | OpenAI vision and structured outputs; free-text needs produce a staff-confirmed draft. |
| Optional indicators | TypeSafe Jev / hybrid behind `ANALYSIS_PROVIDER`; Jev does no OCR/date/number extraction. |
| Geocoding | Government BAN address data through IGN Géoplateforme, `https://data.geopf.fr/geocodage/`. Backend geocoding only; no routing service. |

Backend dependencies are pinned in backend/pyproject.toml and backend/uv.lock with a 2026-10-18 release cutoff. Frontend dependencies are pinned in frontend/package.json and frontend/pnpm-lock.yaml. Check both manifests before adding dependencies; prefer releases at least seven days old.

## Documentation

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Binding product/security rules, provider contract and delivery gates. |
| [Requirements](docs/requirements.md) | Scope, actors, BR/FR/NFR IDs and open AMB decisions. |
| [Domain model](docs/domain-model.md) | Corrected entities, independent budgets, lifecycles, working defaults and recovery. |
| [Analysis rules](docs/analysis-rules.md) | Five closed extraction/indicator contracts, probabilities, uncertainty and immutable provenance. |
| [Expiry rules](docs/expiry-rules.md) | Exclusive buckets, source dates/PAO, Python date checks and deterministic FEFO. |
| [Rule test cases](docs/rules-test-cases.md) | Analysis/date/FEFO acceptance scenarios; backend evidence is in readiness. |
| [Features and use cases](docs/features.md) | Acceptance criteria, traceability and illustrative 40-hour allocation. |
| [Architecture](docs/architecture.md) | Components, interaction design and current Archify validation evidence. |
| [Database design](docs/databases.md) | Columns, constraints, RLS, locks, accounting and working domain constraints. |
| [REST API](docs/api.md) | Implemented FastAPI route contracts, DTOs, permissions, errors and examples. |
| [Setup](docs/setup.md) | Backend setup, environment, executable checks and remaining Supabase deployment configuration. |
| [Handoff and audit](docs/handoff.md) | Decisions, contradictions, assumptions, blockers, milestones and risks. |
| [Readiness report](docs/readiness.md) | Actual backend checks, implementation invariants and pending release gates. |

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

The complete ERD uses a dense schema view; current validation/capture results and any layout advisories are recorded in architecture.md. Editable JSON sources and current evidence are preserved alongside HTML. The existing broad architecture JSON ignore rule remains; explicitly review source tracking before staging new diagram JSON. Historical captures do not prove revised artifacts.

## Design choices clarified

Closed vocabularies such as roles, unit, category and state use named PostgreSQL enums, with allowed values shown at each table column. Unit item, storage unit item_slot and calendar-season semantics form the proposed working MVP profile; new units require an explicit later design change. `attributes` holds validated item facts and need criteria, so it retains that name; technical provenance is separate. By the user's revised choice, Postgres stores base64 image text in private.photo_contents; donation_photos holds metadata/digests. Supabase Storage and bucket configuration are removed. Authenticated content routes decode and serve bytes; list DTOs contain no base64 payload. See the [database explanations](docs/databases.md).

The API uses `/api/v1/account/profile` and `/api/v1/account/memberships` for the signed-in user. All business routes belong to FastAPI; Next.js renders the frontend.

## Run the frontend demo

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` and choose a demo persona on `/login`. Data and actions stay in browser-local storage. No service credentials are required for the demo. See [frontend setup and limits](frontend/README.md). The backend runs separately; starting both servers does not connect them.

## Run the backend

```sh
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload
```

Configure the backend-only values described in [setup](docs/setup.md). The interactive API reference is served at `/docs`, with OpenAPI at `/openapi.json`. Protected operations require a Supabase bearer token; missing provider credentials produce explicit unavailable errors, with manual donation entry preserved. No development auth bypass is installed.

```sh
# From backend/
uv run ruff check .
uv run mypy app
uv run pytest
```

The [handoff](docs/handoff.md) records decisions, implementation boundaries and the next verification work. Existing [interactive diagrams](docs/architecture.md#interactive-diagrams) are preserved; their artifact validation is separate from backend test evidence.
