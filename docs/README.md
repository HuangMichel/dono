# Documentation

Start with [Development setup](setup.md) to run Dono. Use [Readiness](readiness.md) to check recorded verification results and remaining deployment work.

[AGENTS.md](../AGENTS.md) defines binding product and security rules. Specifications describe required behavior. Test reports describe only the code and environment checked in that report.

## Setup and operation

| Document | Purpose |
|---|---|
| [Development setup](setup.md) | Environment variables, local services, migrations, and Vercel deployment. |
| [Frontend](../frontend/README.md) | Browser workflows, frontend configuration, and checks. |
| [Readiness](readiness.md) | Recorded checks, integration limits, and deployment gates. |
| [Handoff](handoff.md) | Historical work checkpoint and outstanding verification. Compare checkout-specific details with the current files before use. |
| [Manual SQL packages](../supabase/manual/README.md) | Ordered SQL packages for hosted database setup. |

## Product and contracts

| Document | Purpose |
|---|---|
| [Requirements](requirements.md) | Scope, actors, business rules, and open decisions. |
| [Features and use cases](features.md) | Acceptance criteria and requirement traceability. |
| [Domain model](domain-model.md) | Entities, resource budgets, lifecycles, deadlines, and recovery. |
| [Analysis rules](analysis-rules.md) | Category extraction, indicators, uncertainty, and provenance. |
| [Expiry rules](expiry-rules.md) | Source dates, PAO, expiry buckets, and FEFO ordering. |
| [REST API](api.md) | FastAPI routes, request and response contracts, permissions, and errors. |
| [Database design](databases.md) | Tables, constraints, RLS, and transaction rules. |
| [Architecture](architecture.md) | Components, trust boundaries, and historical interactive diagrams. |

## Design

| Document | Purpose |
|---|---|
| [Design system](../DESIGN.md) | Tokens, typography, components, accessibility, and UI wording. |
| [Screen references](design/README.md) | Chosen layouts, flow rules, and limits of static mockups. |
| [Visual identity](brand/README.md) | Selected logo, exports, colors, and usage rules. |

## Verification

| Document | Purpose |
|---|---|
| [Test plan](test-plan.md) | Local checks, real-system scenarios, and acceptance gates. |
| [API curl tests](api-curl-tests.md) | Script setup, test accounts, coverage, and limits. |
| [Rule test cases](rules-test-cases.md) | Analysis, expiry, and FEFO acceptance scenarios. |
| [API test report, 2026-10-25](reports/api-tests-2026-10-25.md) | Historical API test results. |
| [Live integrations, 2026-10-25](reports/live-integrations-2026-10-25.md) | Historical checks against external services. |
| [OpenAI example, 2026-10-25](reports/openai-example-2026-10-25/README.md) | Recorded analysis example and evidence limits. |

Historical reports and screenshots do not prove the current checkout or deployment. The architecture guide identifies missing source and validation files. Static mockups contain fictional examples and do not establish API support.
