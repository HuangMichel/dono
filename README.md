# Dono

Dono helps donors offer usable goods to associations that need them and have space. AI extracts facts and supplies indicators. Association staff approve or refuse each offer.

The application uses a Next.js frontend, a FastAPI backend, and Supabase Auth and PostgreSQL. See [setup](docs/setup.md) for local and Vercel configuration. The [readiness report](docs/readiness.md) records completed checks and remaining integration work. Source implementation does not establish deployment readiness.

## Donation workflow

1. Browse nearby association needs without an account.
2. Sign up or sign in with email and password to offer an item.
3. Upload photos, review the analysis indicators, and confirm or correct the item facts. Manual entry remains available when analysis fails.
4. Find eligible associations and send an offer. Donors can also explicitly post an item for authenticated association browsing.
5. After staff approval, book a drop-off appointment and retrieve its QR pass.
6. Association staff record full-lot reception and distribution.

Each recipient offer has its own decision and history. An item can be offered again after refusal, cancellation, or expiry. Posting does not create an addressed offer, approval, reservation, or booking. Association claiming is outside the current contract.

The five categories are clothes, shoes, non-perishable food stored at room temperature, parapharmacy and hygiene products, and small furniture brought by the donor. Medicines cannot be donated. Chilled or frozen food from individuals is outside scope.

## Product rules

[AGENTS.md](AGENTS.md) defines the binding rules and verification requirements.

- Only authorized association staff approve or refuse donations. AI results use indicator language and show their provenance.
- Donor corrections remain separate from original AI extraction and indicators.
- Code computes expiry, counts, and distance. Derived expiry values are calculated at read time.
- Matching uses need, capacity, season, and Haversine distance. It makes no model call.
- Donation status stays in the app. The MVP has no transport, pickups, routing, messaging, or donation notification emails. Account confirmation emails are allowed.

The [domain model](docs/domain-model.md) defines roles, independent resource budgets, offer deadlines, booking, and recovery. The [requirements](docs/requirements.md) and [feature specification](docs/features.md) define scope and acceptance criteria.

## Run locally

Configure the environment and database prerequisites in [Development setup](docs/setup.md) first. Use Node.js 24 LTS and the pnpm version pinned in `frontend/package.json`.

Start the backend from the repository root:

```sh
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload
```

In a separate terminal, start the frontend from the repository root:

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open [the application](http://127.0.0.1:3000) or [the API reference](http://127.0.0.1:8000/docs). Protected API operations require a Supabase user access token. See [frontend setup](frontend/README.md) for public configuration and browser workflows.

## Checks

Run frontend checks from `frontend/`:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run backend checks from `backend/`:

```sh
uv run ruff check .
uv run mypy app
uv run pytest
```

These commands do not replace hosted Auth, database, photo-analysis, or complete donor-to-staff acceptance checks. See [readiness](docs/readiness.md) for the recorded evidence and limits.

## Documentation

The [documentation index](docs/README.md) links to setup, product rules, API and database contracts, design references, test plans, and historical reports.

The [architecture guide](docs/architecture.md#interactive-diagrams) links to ten standalone diagrams. Some exports retain historical labels. Their editable JSON sources and machine-readable validation receipts are absent from this checkout.
