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

- Next.js (App Router, TypeScript) · Tailwind CSS · shadcn/ui
- Supabase: Auth, Postgres with row-level security, Storage (donation photos)
- OpenAI API: vision + structured outputs (JSON schema per category)
- TypeSafe Jev: optional, behind `ANALYSIS_PROVIDER` (image support is experimental and requires the `TypeSafe-Danger-Zone-Images: true` header)
- API Adresse (data.gouv.fr) for geocoding

Check `package.json` before adding a dependency; prefer versions published at least 7 days ago.

## Planned layout

```
app/
  (donor)/            scan, offers, my-donations, booking
  (association)/      dashboard, review, needs, capacity, slots, reception, images
  (admin)/            association approval
  api/                route handlers (analysis, needs parsing, matching, qr)
lib/
  analysis/           provider interface + openai.ts, jev.ts, hybrid.ts
  analysis/schemas/   one JSON schema + prompt per category
  expiry.ts           days left, buckets, FEFO
  matching.ts         need + capacity + season + distance
  geo.ts              API Adresse client + Haversine
  supabase/           server and browser clients
supabase/
  migrations/         schema + RLS policies
  seed.sql            demo associations, needs, redirect points
docs/architecture/    archify candidate.json + rendered HTML
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

- `OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are server-only. Never import them in client components or prefix them with `NEXT_PUBLIC_`.
- Never commit `.env*` files other than `.env.example`.
- Validate uploaded files (type, size) before sending them to a model.

## Commands

> Not scaffolded yet — update this section once `package.json` exists.

```sh
pnpm dev            # local dev server
pnpm lint           # lint
pnpm typecheck      # tsc --noEmit
pnpm test           # unit tests (expiry, matching, schema parsing)
```

Regenerate the architecture diagram after editing `docs/architecture/candidate.json`:

```sh
node ~/.agents/skills/archify/bin/archify.mjs finalize architecture docs/architecture/candidate.json docs/architecture/dono-architecture.html --quality showcase --json
```

## Verification before finishing a task

1. `pnpm lint && pnpm typecheck && pnpm test` pass.
2. Unit tests cover `lib/expiry.ts` (boundaries: today, expired, unreadable date) and `lib/matching.ts` (capacity full, season, distance ordering).
3. Analysis changes are checked against the photo test set (`tests/fixtures/photos/`, 25–35 images including medicines and para products).
4. No UI path shows an AI-made approve/refuse decision.

## Scope priorities

If time runs short, cut in this order: Jev integration → OpenAI vs Jev comparison → expiry timeline chart → AI vs human agreement metric. Never cut: indicators, expiry buckets + distribute-first list, review queue, QR reception, auth/RLS.
