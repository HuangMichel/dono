# Dono local setup plan

Reviewed 2026-10-24. **The application is not scaffolded.** There is no `package.json`, dependency lockfile, application test runner, Supabase project configuration, migration or seed file. This is a preparation/runbook proposal, not evidence that the commands or infrastructure work. [AGENTS.md](../AGENTS.md) governs implementation; consult the [handoff decisions](handoff.md#decisions-needed-before-dependent-work) first.

## What works at this baseline

Read the [documentation index](../README.md#documentation) and open the seven standalone [HTML diagrams](architecture.md#interactive-diagrams) directly in a browser. No package installation or application server is needed to view them.

The root [.env.example](../.env.example) contains blank placeholders. You may copy it to `.env.local` if that file does not already exist; do not overwrite an existing configuration. `.env.local` and other `.env*` files are ignored, except the root template. No credentials are supplied or required to review the design.

## Prerequisites for future implementation

Choose a supported Node.js LTS release compatible with the selected Next.js, Supabase libraries and CLI, then pin the runtime and pnpm version in the future scaffold. No versions are selected here. Check package publication dates and compatibility, prefer releases at least seven days old, pin dependencies and commit the lockfile. Installing dependencies is outside this review.

Use Git, a browser with camera/file-input support for the donor flow, and a camera-capable browser for reception testing. HTTPS and camera permission behavior must be checked on the selected mobile device; successful desktop rendering is insufficient. The supported browser/device matrix remains AMB-019.

Two Supabase development options remain available: a dedicated hosted development project, or a local CLI-managed stack. The documented container-based local path requires the Supabase CLI and a Docker-compatible runtime. Select and record the environment before writing its runbook; this review initializes neither option. See [Supabase local development](https://supabase.com/docs/guides/local-development).

## Supabase configuration to perform later

1. **Choose the environment and migration workflow.** Keep development/test data separate from production. No `supabase/config.toml` or schema workflow exists. Decide imperative migrations versus declarative schemas before creating objects. Review installed CLI help before issuing initialization, start, status or migration commands; no reset or remote database push is part of this setup review.
2. **Configure Auth without outbound email.** Resolve AMB-001/002: sign-in method, session transport, initial association-admin membership, role assignment/revocation and platform-operator provisioning. Configure site origin/redirect allowlists for that method. Do not introduce magic links, email confirmation/reset, SMTP or invitations as an MVP dependency. Demo account provisioning must use a deliberate trusted path, not self-editable role metadata.
3. **Select API keys.** Prefer the publishable/secret pair for a new project. The earlier anon/service-role names remain compatibility placeholders pending the implementation choice. Public keys identify the app; they do not replace user sessions. Privileged keys bypass RLS and remain server-only. See [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).
4. **Review the schema before creating it.** Resolve DB-P01–DB-P07 and their affected AMB decisions. Then implement the [dictionary, constraints and indexes](databases.md#data-dictionary), same-tenant/item composite FKs, immutable evidence and append-only inventory guards. Include all 13 required entities and the three documented support tables. Do not modify Supabase-managed Auth/Storage table definitions.
5. **Provision grants and RLS together.** Explicitly grant only the selected reads and command entry points; deny ordinary client DML. Enable scoped RLS on exposed tables and defense-in-depth RLS on the private retry ledger. Configure memberships without policy recursion. Test direct Data API access as well as the app. New-table exposure defaults are changing; verify project settings rather than assuming implicit grants. See [API security](https://supabase.com/docs/guides/api/securing-your-api) and the [table-exposure changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
6. **Review privileged command boundaries.** Implement atomic state-changing commands with explicit actor/field/state checks, expected revisions, consistent lock order and durable retry identities. Private definer bodies need pinned search paths and exact execution grants. Upload/analysis persistence and QR-confirmed receipt must reject direct client RPC forgery. A server key does not establish donor ownership or staff membership.
7. **Create private photo Storage.** Select a bucket name and agreed MIME/content/size/count limits (AMB-003). No public bucket or client upsert over analyzed bytes. Bind generated object paths to verified metadata; implement authenticated content reads through the planned handler. Resolve orphan cleanup and retention (AMB-015). See [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
8. **Prepare isolated demo/test data.** At least two donors, two associations with distinct memberships, a platform operator, needs/capacity/slots and redirect points are needed for the planned tests. Use synthetic data. No real project, accounts, seed data, bucket, grants or policies were created or inspected during this task.

The current Supabase changelog and relevant guides were checked on 2026-10-24; recheck them when implementing. The markdown changelog endpoint could not be rendered by the browser tool, so the [HTML changelog](https://supabase.com/changelog?types=breaking-change) and linked change were consulted. The [SSR client guide](https://supabase.com/docs/guides/auth/server-side/nextjs) informs the future browser/server session integration; use the chosen version's verifier rather than trusting an unverified session object. No cookie helper or SDK call is implemented here.

## Environment contract proposal

All assignments in [.env.example](../.env.example) are blank. Values belong only in ignored local configuration or the deployment secret store. Configuration names are a design proposal until consumed by code; copying the file neither validates it nor enables optional modes.

| Variable | Visibility | Intended purpose / prerequisite |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | URL of the chosen development project/stack. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible | Recommended public app key; user authorization still uses a verified session and RLS. |
| `SUPABASE_SECRET_KEY` | Server-only | Recommended privileged credential for the narrowly authorized server capabilities, if selected. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-visible | Earlier legacy public-key name; leave blank if the publishable pair is selected. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Earlier legacy elevated-key name protected by AGENTS.md; leave blank if the secret pair is selected. |
| `OPENAI_API_KEY` | Server-only | Required OpenAI provider credential. |
| `OPENAI_MODEL` | Server-only configuration | Select a model supporting the agreed vision/structured schema; no model or pricing promise is made. |
| `ANALYSIS_PROVIDER` | Server-only configuration | Required baseline value `openai`; optional `jev`/`hybrid` remain disabled until AMB-018 and viability checks are resolved. |
| `TYPESAFE_API_KEY` | Server-only | Optional Jev credential; unnecessary for the required baseline. |
| `APP_ORIGIN` | Server-only configuration | Exact configured app origin for the chosen same-origin/session checks; local port remains to be selected. |
| `QR_SIGNING_KEY` | Server-only | Proposed separate signing secret generated locally with a cryptographic tool after choosing the signing scheme; never reuse a provider/Supabase key. |
| `DONATION_PHOTOS_BUCKET` | Server-only configuration | Chosen private bucket name; not created by setting this value. |
| `GEOCODING_BASE_URL` | Server-only configuration | Chosen official geocoding base endpoint after AMB-021; never a donor-supplied arbitrary URL. |

Choose one Supabase key pair explicitly and document the implementation's accepted names. No automatic fallback, precedence or mixed-pair support exists. Do not put a secret/service key into any `NEXT_PUBLIC_` variable. AGENTS.md's server-only rule extends to the new secret and QR signing names. Database passwords and CLI management tokens are not application variables in this design and are not included in the template.

Upload limits, expiry timezone/bucket/PAO rules, medicine thresholds, units/season matching, QR lifetime, retry/lease windows, retention, request timeouts and cost controls need decisions. Do not invent numeric defaults by filling the template. Bind the agreed settings during implementation, validate them on startup, and add documented configuration names then. The API's proposed `policy_required` response is diagnostic behavior, not a substitute for completing required MVP policies.

## Geocoding integration decision

The official address-service page announces that the old `api-adresse.data.gouv.fr` URL was to be decommissioned at the end of January 2026 and points integrators to Géoplateforme. The current government service listing gives `https://data.geopf.fr/geocodage/` as the base URL. These are provider notices, not a runtime availability test. Resolve endpoint/adapter compatibility under AMB-021 before setting `GEOCODING_BASE_URL`; confirm coordinate ordering, error handling and limits with the current official contract. Keep AGENTS.md authoritative and record any approved stack wording change before regenerating diagrams. [Official migration notice](https://adresse.data.gouv.fr/outils/api-doc/adresse), [government API listing](https://www.data.gouv.fr/dataservices/api-adresse-base-adresse-nationale-ban).

Geocoding still supplies coordinates only. Haversine distance, matching and eligibility remain deterministic code; there is no travel-time or route API. Address retention and later review revalidation remain AMB-009/016.

## Planned application quickstart

**Prerequisites for this block:** resolve dependent policies, create the approved scaffold/scripts, install pinned tooling, implement reviewed migrations/seed data and provision the chosen Supabase environment. These commands have not been run and cannot start an app in this repository today.

```sh
# Future commands only, from the repository root after scaffolding.
pnpm install
cp .env.example .env.local  # only if absent; populate approved local settings
# Apply the future reviewed migration/seed runbook to development only.
pnpm dev
```

Document the actual URL, supported tool versions and migration commands after successful implementation. Do not claim `localhost:3000`, Supabase default ports or a successful health check as observed project behavior.

For the future local-stack path, start with the installed CLI's `supabase --help` and subcommand help. Its invocation may be global or through a pinned package runner. The exact initialization/start/status commands and migration procedure need verification with that selected version. No CLI package was installed or project linked in this review.

## Planned verification commands and evidence

| Command / check | Intended verification | Current status |
|---|---|---|
| `pnpm lint` | Lint application source and server/client boundaries. | Planned script; unavailable. |
| `pnpm typecheck` | TypeScript checks, expected `tsc --noEmit`. | Planned script; unavailable. |
| `pnpm test` | Deterministic unit tests and the selected test runner. | Planned script; unavailable. |
| RLS/Storage/command integration suite | Two-donor/two-association isolation, direct table/RPC/Storage access and forbidden field/role mutations. | Runner/database fixtures not created. |
| Concurrent transaction suite | Last capacity/last slot races, retry-key conflicts, duplicate QR reception and excessive distribution. | Harness not created. |
| Analysis evaluation | 25–35 photos including medicines/para; schema parsing, uncertainty, warnings and immutable originals after overrides. | `tests/fixtures/photos/` not created. |
| Browser acceptance | Mobile capture, provenance/mismatch display, staff review, QR, stock, expiry/FEFO and indicator wording. | App/device matrix not created. |

Expiry tests need today, expired and unreadable dates, 7/30/90 boundaries, configured timezone/DST, partial dates and PAO. Matching tests need capacity full, need/season compatibility and Haversine ordering under the resolved radius/tie policy. Preserve original probabilities through edits, reanalysis and decisions; test that neither a failed model call nor a QR scan can set a donation decision.

At application delivery run the three AGENTS.md commands together, exercise the integration/photo/browser checks above, and record actual results. The existing Archify receipts verify diagrams only; they cannot satisfy any of these application gates. For documentation edits, check links, ID references, JSON examples, template/ignore behavior and preserved artifact identities as recorded in the [readiness report](readiness.md).
