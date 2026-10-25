# Dono local setup plan

Status: **frontend demo available; service integration remains planned**. Run the browser-local dummy-data app using [frontend/README.md](../frontend/README.md). It needs no secrets, API or database. Python FastAPI will own every business API operation; no backend, migrations, live authentication or photo evaluation set exists. The service setup instructions below remain proposals. Read [AGENTS.md](../AGENTS.md) and the [decision register](requirements.md#ambiguities-and-decisions-required) before implementing them.

## Review the design today

Read the [documentation index](../README.md#documentation) and open the [standalone diagrams](architecture.md#interactive-diagrams) or [mockup board](design/index.html). No application server is needed. The architecture guide distinguishes restored sources, current checks and historical diagrams/captures.

The root [.env.example](../.env.example) contains blank placeholders only. It is a combined reference for **two separate future application environments**, not a file to copy wholesale into Next.js. All `.env*` files except this root template are ignored. Preserve any existing local configuration when implementing.

## Future toolchains and boundaries

The frontend manifest and pnpm lockfile now pin the installed UI dependencies. Choose supported Python/uv versions when the FastAPI project is authorized. Check existing manifests before adding dependencies and prefer versions at least seven days old. Backend tooling remains uninstalled.

The frontend displays donor, association and platform views and establishes/refreshes Supabase Auth sessions under the agreed no-email sign-in method. It sends the user's access token to FastAPI using Authorization: Bearer. FastAPI verifies it and resolves current permissions; an app API key is not a user's identity. Provider calls, file validation, matching, expiry and transaction commands live in Python. Next.js business Route Handlers/server actions are not part of the revised backend. See [JWT verification](https://supabase.com/docs/guides/auth/jwts).

Production can use a common public origin with `/api/v1` routed to FastAPI. For separate local origins, configure an exact frontend-origin allowlist and required headers/methods/preflight; a public API base URL is safe to expose, while backend secrets are not. Do not infer cookie authentication for FastAPI from Supabase SSR cookies. CORS never replaces auth. The actual origins/ports are unselected. [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)

Use thin FastAPI routers, Pydantic input/output models, services for orchestration and persistence/provider adapters with pure domain calculations. The existing proposal uses user-JWT-scoped Supabase reads and guarded database command functions. It does not require adding an ORM or a second persistence implementation to meet the stack change. Never reuse mutable per-user auth state in a shared backend client. Any later direct-Postgres/ORM path must preserve the documented identity, RLS and transaction invariants explicitly.

Camera/file input and QR permissions require checks on the agreed mobile/browser matrix (AMB-019). Neither desktop diagram rendering nor the developer's current tool installations prove target-device support.

## Supabase configuration to perform later

1. Select a dedicated hosted development project or CLI-managed local stack. The container-based local path needs a Supabase CLI and Docker-compatible runtime. Select imperative migrations versus declarative schema workflow before initialization; no supabase/config.toml exists. Review the installed CLI's --help and subcommand help before running project commands. [Supabase local development](https://supabase.com/docs/guides/local-development)
2. Resolve AMB-001/002: sign-in without outbound email, association-applicant bootstrap, platform provisioning, RNA/SIRET checks and role assignment/revocation. Configure only the chosen origins/redirects and authentication method. No SMTP, magic-link, email-confirmation/reset or invitation dependency is added to the MVP.
3. Use publishable app keys and a separate server-only secret key for the documented restricted capabilities. The template uses current key names; no legacy-key fallback is specified. A secret key bypasses RLS and belongs only to FastAPI. Any legacy service-role key remains subject to the same AGENTS secrecy rule. [Supabase keys](https://supabase.com/docs/guides/getting-started/api-keys)
4. Resolve affected DB-P01–DB-P07 choices, then review the [dictionary and named enum catalog](databases.md#enumerated-types) before generating migrations. Shared category/unit enums must agree across tables and Pydantic/frontend models. Unit/season vocabularies are still provisional. No enum types or tables were created here.
5. Provision explicit grants and RLS together. Ordinary clients receive only scoped reads and selected invoker command entry points; deny direct DML. Private definer commands need exact execution grants, pinned search paths and explicit actor/tenant/field checks. Keep ordinary reads under the user's JWT; privileged keys are not a replacement for ownership checks. Test direct Data API/RPC/Storage access, including provider-output or QR-proof forgery. [API security](https://supabase.com/docs/guides/api/securing-your-api)
6. Create a private donation-photo bucket with agreed MIME/content/byte/count limits (AMB-003). FastAPI uploads valid immutable bytes, records object paths/digests in Postgres and authorizes content reads. No base64 image column or public bucket is planned. Resolve failed-upload cleanup and retention (AMB-015). [Photo design](databases.md#why-photos-use-storage-instead-of-base64-database-text), [Storage controls](https://supabase.com/docs/guides/storage/security/access-control)
7. Implement one atomic database command per state change, using the common lock order, expected revisions and durable idempotency protocol. No remote provider call or Storage transfer may hold the transaction open. The FastAPI split changes the HTTP boundary, not capacity/booking accounting requirements.
8. Prepare synthetic demo/test data with at least two donors, two associations with distinct memberships, a platform operator, needs/capacity/slots and redirect points. No accounts, bucket, policies or remote settings were provisioned or inspected in this review.

The [Supabase changelog](https://supabase.com/changelog?types=breaking-change) and current guides were consulted. Its markdown index could not be rendered by the browser tool; the HTML index was used. New-table exposure defaults require reviewing grants independently from RLS. Recheck the selected CLI/library versions at implementation time; this runbook does not supply unverified migration commands or reset/push a database.

## Environment contract proposal

Select only the settings belonging to each future application. Frontend public settings belong in ignored frontend/.env.local; FastAPI-only settings belong in ignored backend/.env or deployment secrets. Do not overwrite existing files. Every value in the root template is blank; copying it neither configures a project nor enables optional providers.

| Variable | Environment | Intended purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend, public | Chosen Supabase project/stack URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Frontend, public | Public app key for Auth/browser integration; user sessions still authorize access. |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend, public | Configured FastAPI base, normally including /api/v1; relative path if behind a common origin, absolute local origin otherwise. |
| `SUPABASE_URL` | FastAPI | Same chosen project URL; no dependency on a NEXT_PUBLIC variable. |
| `SUPABASE_PUBLISHABLE_KEY` | FastAPI | Public app key used alongside user JWTs for ordinary scoped reads/commands. |
| `SUPABASE_SECRET_KEY` | FastAPI secret | Elevated key only for the explicitly restricted server capabilities. |
| `OPENAI_API_KEY` | FastAPI secret | Required baseline provider credential. |
| `OPENAI_MODEL` | FastAPI config | Chosen compatible vision/structured-output model; no model/cost promise. |
| `ANALYSIS_PROVIDER` | FastAPI config | Required baseline openai; optional jev/hybrid disabled until AMB-018 is resolved. |
| `TYPESAFE_API_KEY` | FastAPI secret | Optional S1 only; leave blank for the required baseline. |
| `APP_ORIGIN` | FastAPI config | Exact allowed frontend origin; single-origin MVP proposal, never wildcard credentials. |
| `QR_SIGNING_KEY` | FastAPI secret | Separate cryptographically generated signing secret after scheme/lifetime agreement. |
| `DONATION_PHOTOS_BUCKET` | FastAPI config | Chosen private bucket name; not created by setting this value. |
| `GEOCODING_BASE_URL` | FastAPI config | Selected BAN/Géoplateforme base https://data.geopf.fr/geocodage/; never donor-controlled. |

Provider/QR/elevated keys must never be passed to Next.js, embedded in NEXT_PUBLIC variables, returned in DTOs or logged. No database password or CLI management token is an application variable in this design. Prefer scoped management access for later provisioning; no management credential is requested now.

Use the fixed `Europe/Paris` timezone for local date and appointment calculations; exchange instants in UTC. Do not add an opening-date setting or calculate PAO expiry: packaged food/hygiene must be unopened. Company donations use existing owner access and company-name attribution, with the same eligible food scope.

Upload limits, expiry bucket boundaries, partial-date/unknown ordering, units/season eligibility, QR lifetime, retry/lease windows, retention, timeouts and cost controls still require decisions. Medicine refinements and approval reservation/release rules are on standby. Do not fill guessed policy defaults into the template.

## Geocoding integration decision

The selected service is the **government BAN address geocoder operated through IGN Géoplateforme**, base https://data.geopf.fr/geocodage/. This matches the current [government BAN API listing](https://www.data.gouv.fr/dataservices/api-adresse-base-adresse-nationale-ban). The [official geocoding guide](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/) describes direct address search and the address index based on BAN data. Use address search, not parcel/POI matching or a route API. The retired api-adresse.data.gouv.fr host is not the selected endpoint.

AMB-021 service selection is resolved by the user's instruction. Before integrating, verify the current search parameters, response coordinate order, errors and limits against the official contract. This is provider documentation verification, not a live adapter smoke test. AMB-009/016 still cover radius, origin retention/disclosure and failed/unknown locations. Haversine distance and matching remain deterministic Python code; no coordinates or routes are invented.

## Planned startup and tests

Prerequisites: approved decisions, scaffold/manifests/scripts, pinned tooling, reviewed migrations/seed data, selected Supabase provisioning, environment loading and origins. **None of the following project commands has been run or is available in this repository today.**

```sh
# Future frontend/ working directory
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
```

```sh
# Future backend/ working directory; app.main:app is the proposed entry point
uv sync
uv run uvicorn app.main:app --reload
uv run ruff check .
uv run mypy app
uv run pytest
```

The command forms follow [uv project execution](https://docs.astral.sh/uv/concepts/projects/run/) and [FastAPI server guidance](https://fastapi.tiangolo.com/deployment/manually/); their target manifests, tools, scripts and app module still need implementation. Record actual startup origins and successful results then.

| Future verification | Required evidence | Current status |
|---|---|---|
| Frontend lint/typecheck/tests | Next.js UI/client checks and absence of backend secrets. | No scripts/runner. |
| Backend Ruff/mypy/pytest | Python types/style; expiry boundaries and Europe/Paris midnight/DST; PAO stays evidence only; matching and frozen need criteria. | No Python project/tests. |
| API contract | All 42 catalog operations, account naming, DTO/enums/decimal strings, static route ordering, error envelope, JWT/CORS/preflight and forbidden fields. | No FastAPI routes. |
| Database/RLS/Storage | Two donors/two associations, direct API/RPC/Storage attempts, no self-escalation or original evidence mutation. | No implemented objects/harness. |
| Transactions | Last-slot bookings, need-edit/approval races, retry fencing, atomic reception quantity correction and duplicate/excess distribution. Approval hold policy remains on standby. | No command implementation. |
| Analysis photos | 25–35 shared photos including medicines/para; schema validity, uncertainty, warnings and immutable originals/mismatch after edits. | tests/fixtures/photos is absent. |
| Browser flow | Target mobile camera/QR and complete donor→staff→distribution flow; read-time expiry/FEFO and indicator wording. | No app/device matrix. |

Run and record the frontend and backend checks plus integration/photo/browser evidence at delivery. Diagram checks cannot satisfy application gates. Current documentation/diagram validation and cleanup evidence are linked in the [readiness report](readiness.md).
