# Dono

> **Scan before you donate.** AI shows whether an item looks usable, which association needs it right now, and lets the association decide.

Hackathon MVP — OpenAI hackathon, **Impact** track (poverty reduction · affordable essentials, with a climate bonus).

## The problem

Associations don't lack donations — they lack the *right* donations, and unusable donations cost them money and volunteer time:

- **Secours Populaire**: an average local structure receives ~100 kg of clothes per day, **60–70 % not directly usable** ([actu.fr](https://actu.fr/societe/on-nous-prend-pour-une-dechetterie-ces-associations-sont-submergees-de-dons-de-vetements-en-mauvais-etat_62021126.html)).
- **Emmaüs Saint-Malo**: **€100,000 / year** to dispose of donations that are neither sellable nor recyclable ([actu.fr](https://actu.fr/bretagne/saint-malo_35288/des-dechets-et-un-loyer-qui-coutent-cher-a-saint-malo-emmaus-cherchent-des-solutions_64954779.html)).
- **Emmaüs Catalogne**: **300 of 1,200 tonnes** unusable, costing **€48,000 / year** ([InfoRadar](https://inforadar.fr/a-proximite-de-perpignan-emmaus-catalogne-submerge-dons-invendables-et-cout-pour-la-communaute)).
- **Secours Populaire Mayenne** suspended clothing collection in January 2026 because of low-quality fast-fashion donations ([Ouest-France](https://www.ouest-france.fr/economie/industries/industrie-textile/dechets-vestimentaires-le-secours-populaire-et-emmaues-victimes-collaterales-de-la-mode-jetable-4dea2cf6-f602-11f0-95b0-d3ffbc2ef006)).

## The solution

1. **Donor** photographs an item → AI shows **indicators** (condition, stains, sealed, expiry date…).
2. Dono matches it to **nearby associations that need it and have room**.
3. Donor sends an **offer** → the **association reviews the indicators and decides** (approve / refuse).
4. If approved, the donor books a **drop-off slot** and gets a **QR code** → scanned at reception → stock and needs update.

**The AI never approves or refuses.** It surfaces indicators; humans decide.

## Categories

| Category | Indicators |
|---|---|
| 👕 Clothes | type, size, season, wear level, stains, holes, pilling |
| 👟 Shoes | pair complete, size, sole wear, upper damage |
| 🥫 Food (non-perishable, room temperature) | product, expiry date, DLC vs DDM, days left, damaged packaging, swollen can |
| 💊 Parapharmacy & hygiene | product, sealed, expiry date, days left, PAO, looks like a medicine (warning) |
| 🛋️ Small furniture (donor brings it) | type, condition, size class, visible damage |

## MVP features

**Authentication & roles** — donor, association admin, association staff, platform admin (Supabase Auth + row-level security). Associations register with RNA/SIRET and are approved manually.

**Donor**
- Scan item (1–2 photos + label close-up for food / para)
- View AI indicators, correct extracted values (size, date)
- Matching: need + capacity + season + distance
- Send offer, track status in **My donations** (offered → approved/refused → booked → received → distributed)
- Book a drop-off slot, get a QR code
- "Other options" list (textile bins, pharmacies, repair cafés)

**Association**
- Needs via form **or free text → AI-structured needs**
- Capacity per category, opening hours, drop-off slots
- Review queue: photos + indicators → **approve / refuse**
- Today's drop-offs, QR scan at reception, mark as distributed, light inventory
- **Image dashboard**: gallery with indicator overlays and filters, **expiry metrics** (expired, < 7 / < 30 / < 90 days, distribute-first list, DLC vs DDM, average shelf life, unreadable dates, timeline), quality metrics (AI vs human agreement)

**Impact** — donations matched, approval rate, kg diverted, estimated € disposal costs avoided, expired items stopped before drop-off.

## Architecture

Open [`docs/architecture/dono-architecture.html`](docs/architecture/dono-architecture.html) in a browser for the interactive diagram.

```
Donor ──▶ Donor PWA ──┐                         ┌──▶ OpenAI API (vision + structured outputs)
                      ├──▶ Next.js API ──▶ Analysis service
Association ──▶ Dashboard ┘      │               └──▶ TypeSafe Jev (optional, probabilities)
                                 ▼
                 Supabase: Auth · Postgres (RLS) · Storage (photos)
```

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) · Tailwind CSS · shadcn/ui |
| Backend | Next.js route handlers / server actions |
| Data & auth | Supabase (Auth, Postgres with RLS, Storage) |
| AI | OpenAI API (vision + structured outputs) · TypeSafe Jev optional |
| Geocoding | [API Adresse](https://adresse.data.gouv.fr/outils/api-doc/adresse) (data.gouv.fr, free, no key) |

**Who does what**

| Responsibility | Owner |
|---|---|
| Category, product, size, expiry date + type, PAO, label text | OpenAI vision + structured outputs |
| Probability indicators (stains, sealed, wear, damage, medicine) | OpenAI by default, Jev optional |
| Free text → structured needs | OpenAI structured outputs |
| Days left, expiry buckets, FEFO ordering, matching, distance | Plain code (deterministic) |
| Approve / refuse | **Association staff** |

## Getting started

> The application is not scaffolded yet. Planned setup:

```sh
pnpm install
cp .env.example .env.local   # fill in the variables below
pnpm dev                     # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin key |
| `OPENAI_API_KEY` | Server-only OpenAI key |
| `OPENAI_MODEL` | Vision-capable model used for analysis |
| `ANALYSIS_PROVIDER` | `openai` (default) · `jev` · `hybrid` |
| `TYPESAFE_API_KEY` | Server-only, only if Jev is enabled |

## Roadmap (out of MVP scope)

- Email notifications, needs posted by email, donor alerts for urgent needs
- Automatic RNA / SIRET verification
- Visual map
- Jev for images once production-ready
- Transfers between associations, pickup logistics
- Partnerships: Refashion, Cyclamed, Emmaüs / Secours Populaire networks

## Disclaimer

Indicators are AI estimates and can be wrong. Associations remain responsible for accepting donations and for applying food-safety and hygiene rules. Medicines cannot be donated through Dono — return them to a pharmacy.
