# AGENTS.md

Guidance for coding agents working on **Dono** — a hackathon MVP (≤ 40 h) that helps associations receive only usable in-kind donations. See `README.md` for the product overview and `docs/architecture/dono-architecture.html` for the system diagram.

## Product rules (non-negotiable)

1. **The AI never approves or refuses a donation.** It returns *indicators* (values + probabilities + confidence). Only association staff set `decision`. Never write UI copy like "Accepted" / "Refused" for AI output; use indicator language ("Stains likely — 61 %").
2. **Dates and numbers are computed in code**, never by a model. The model extracts `expiry_date`, `date_type` (DLC / DDM / expiry / PAO) and `pao_months`; code computes days left, expired flag, buckets (< 7 / < 30 / < 90 / > 90 days) and FEFO ordering at read time. Do not store derived values.
3. **Matching is deterministic code**: need + capacity + season + distance (Haversine). No model in the matching path.
4. **Medicines are never donatable.** If the "looks like a medicine" indicator is high, show a warning and point to a pharmacy.
5. **Food from individuals** is limited to non-perishable, room-temperature products. Chilled/frozen items get a warning indicator.
6. **No transport, no messaging channels** (no pickups, no Telegram, no email) in the MVP. All status lives in the app.

## Stack

- Frontend: Next.js (App Router, TypeScript) · Tailwind CSS · shadcn/ui
- Backend: FastAPI (Python), Pydantic request/response schemas; all business REST endpoints live here
- Supabase: Auth, Postgres with row-level security, Storage (donation photos)
- OpenAI API: vision + structured outputs (JSON schema per category)
- TypeSafe Jev: optional, behind `ANALYSIS_PROVIDER` (image support is experimental and requires the `TypeSafe-Danger-Zone-Images: true` header)
- Government BAN address geocoding via IGN Géoplateforme (`https://data.geopf.fr/geocodage/`); no routing service

Check the future `frontend/package.json` and `backend/pyproject.toml` before adding a dependency; pin versions and lockfiles, preferring releases published at least 7 days ago.

## Frontend design

- Read [DESIGN.md](DESIGN.md) before frontend work. Use its semantic colors, typography, components, accessibility rules and UI wording.
- Use the chosen mockups listed in [docs/design/README.md](docs/design/README.md) for screen layouts. If a mockup's raw classes conflict with `DESIGN.md`, follow `DESIGN.md`.
- Check behavior against the confirmed rules in [docs/requirements.md](docs/requirements.md), [docs/features.md](docs/features.md) and the contract in [docs/api.md](docs/api.md). Report contradictions. Mockup examples and provisional actions do not establish product rules or API support.

## Planned layout

```text
frontend/              Next.js UI only
  app/                 donor, association and platform approval views
  lib/supabase/        public Auth/browser integration; no privileged keys
backend/               FastAPI application (planned, not scaffolded)
  app/main.py          application/router composition
  app/api/             /api/v1 routers, authentication dependencies, error mapping
  app/services/        analysis, matching, review, booking and inventory orchestration
  app/domain/          pure expiry.py, matching.py and validated domain rules
  app/adapters/        Supabase persistence/storage, providers and BAN geocoding
  app/analysis/schemas/ category extraction/indicator schemas and prompts
  tests/               Python unit, API and concurrency checks
supabase/
  migrations/          schema, named enum types, grants and RLS policies
  seed.sql             demo associations, needs and redirect points
tests/fixtures/photos/ shared analysis evaluation set (not created)
docs/architecture/     editable Archify sources, standalone HTML and current evidence
```

## Analysis provider contract

All providers implement the same interface and return the same shape, so the UI never depends on a provider:

```ts
type Indicator = { key: string; value?: string; probability?: number; level?: "low" | "medium" | "high" };
type AnalysisResult = {
  provider: "openai" | "jev" | "hybrid";
  model: string;
  category: "clothes" | "shoes" | "food" | "para" | "furniture";
  extracted: Record<string, unknown>;   // size, product, expiry_date, date_type, pao_months…
  indicators: Indicator[];
  confidence: number;
};
```

- `openai`: extraction + indicators via structured outputs.
- `jev`: probability indicators only (Noul / Score); never use it for OCR, dates or numbers.
- `hybrid`: OpenAI for extraction, Jev for probability indicators.

## Data model

`profiles` · `associations` · `association_members` · `capacity` · `needs` · `donations` · `donation_analysis` · `donation_indicators` · `expiry_info` · `slots` · `bookings` · `inventory_movements` · `redirect_points`

Roles: `donor`, `assoc_admin`, `assoc_staff`, `platform_admin`. Every table touching association data must have RLS scoped by `association_members`; donors only see their own donations.

## Security

- `OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_SECRET_KEY`, any legacy `SUPABASE_SERVICE_ROLE_KEY`, and `QR_SIGNING_KEY` belong only to FastAPI server configuration. Never import them into the Next.js frontend or prefix them with `NEXT_PUBLIC_`.
- Never commit `.env*` files other than `.env.example`.
- Validate uploaded files (type, size) before sending them to a model.

## Commands

> Neither frontend/package.json nor backend/pyproject.toml exists. Every command below is planned and unverified; update once the respective tool configuration and scripts exist.

```sh
# From the future frontend/ directory:
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
# From the future backend/ directory, after uv/pyproject setup:
uv run uvicorn app.main:app --reload
uv run ruff check .
uv run mypy app
uv run pytest
```

## Verification before finishing a task

1. Once scaffolded, frontend lint/typecheck/tests and backend Ruff/mypy/pytest pass; neither toolchain currently exists.
2. Unit tests cover `backend/app/domain/expiry.py` (boundaries: today, expired, unreadable date) and `backend/app/domain/matching.py` (capacity full, season, distance ordering).
3. Analysis changes are checked against the photo test set (`tests/fixtures/photos/`, 25–35 images including medicines and para products).
4. No UI path shows an AI-made approve/refuse decision.

## Scope priorities

If time runs short, cut in this order: Jev integration → OpenAI vs Jev comparison → expiry timeline chart → AI vs human agreement metric. Never cut: indicators, expiry buckets + distribute-first list, review queue, QR reception, auth/RLS.
