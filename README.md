# Veebase RCM Intelligence Platform

> **Agentic-AI Revenue Cycle Management (RCM) for healthcare providers — built for the Egyptian market (NHIA, private payers, self-pay; currency EGP).**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-DB-003b57?logo=sqlite)
![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun)
![FHIR](https://img.shields.io/badge/HL7%20FHIR-R4-e23237)
![CI](https://github.com/Hmzeid/veebase-rcm-intelligence-platform/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

Veebase orchestrates **12 specialized AI agents** across the revenue cycle, driving each claim through a deterministic, explainable pipeline — from eligibility verification to payment posting — while enforcing a **Human-in-the-Loop (HITL)** governance model so that nothing prohibited by policy is ever auto-executed. Every state change is written to an immutable audit trail, and the platform exposes a full **inbound + outbound integration API** (native JSON, HL7 FHIR R4, and signed webhooks).

---

## Table of Contents

- [Feature Highlights](#feature-highlights)
- [The 12 Agents](#the-12-agents)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [AI Providers](#ai-providers)
- [Access Control (RBAC)](#access-control-rbac)
- [Database Portability](#database-portability)
- [Scale-Out & Observability](#scale-out--observability)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Integration](#integration)
- [Security & Governance](#security--governance)
- [Internationalization (i18n / RTL)](#internationalization-i18n--rtl)
- [License](#license)

---

## Feature Highlights

- **12 specialized RCM agents** across 4 categories (linear pipeline, sentinel, knowledge, analytics).
- **Deterministic RCM engine** — a pure, explainable rules engine that advances claims through the lifecycle, computes a **readiness score** and a **denial-risk score**, and applies a per-payer rule book (prior-auth thresholds, timely-filing windows, appeal windows, reimbursement rates).
- **Human-in-the-Loop governance** — `AUTO` / `REVIEW` / `APPROVE` gates. Auto-processing **stops** at any human gate. Prohibited actions (auto-accepting low-confidence coding, auto write-off, submitting a dirty claim, etc.) are never performed automatically.
- **Pluggable AI providers** — chat (LLM) and PDF extraction (VLM) run through a provider-agnostic router with automatic **failover**: pick **z.ai** (bundled, default), **OpenAI-compatible** (OpenAI, Groq, Together, OpenRouter, vLLM, LM Studio), **Anthropic Claude**, or **local Ollama**; switch at runtime from Settings. A deterministic knowledge base is the always-on final fallback.
- **Role-based access control (RBAC)** — five roles (ADMIN, RCM_MANAGER, BILLER, COMPLIANCE, VIEWER) mapped to a capability matrix, DB-backed users with scrypt-hashed passwords, and an optional sign-in gate.
- **DB-backed persistence** with Prisma. **SQLite** is the zero-config default; the data layer is provider-agnostic and can target **Postgres/MySQL** with no code changes (`scripts/switch-db.sh`).
- **Production-ready operations** — optional **PHI encryption-at-rest** (AES-256-GCM), optional **Redis** shared store for cross-instance rate limiting, and a `/api/metrics` endpoint (JSON or Prometheus).
- **Integration API** — internal/UI endpoints plus a versioned external `v1` API with API-key auth, batch ingestion, FHIR R4, and outbound HMAC-signed webhooks.
- **OpenAPI 3.0 spec** at `/api/openapi.json` and **interactive Swagger UI** at `/docs`.
- **Document ingestion** — PDF → claim extraction (VLM-assisted, with template-based fallback) and hospital-specific templates.
- **Full UI** — Dashboard, Agents, Claims (with a live "Run Agents" engine button), Ingestion Hub, Escalations (5-level ladder), Audit Trail (CSV export), Payer Rules, Analytics, AI Chat, and Settings.
- **Bilingual** — English + Arabic with full right-to-left (RTL) layout flip; locale persisted to `localStorage`.

---

## The 12 Agents

| # | Agent | Display Name | Category | Role |
|---|-------|--------------|----------|------|
| 1 | `EligibilityBenefits` | Eligibility & Benefits | LINEAR | Verifies insurance coverage, benefits, copays, and demographic accuracy before service. |
| 2 | `PriorAuthorization` | Prior Authorization | LINEAR | Manages preauthorization requirements, submits auth requests, tracks approval status. |
| 3 | `ChargeCapture` | Charge Capture & Integrity | LINEAR | Identifies billable services not yet captured as charges; prevents silent under-billing. |
| 4 | `MedicalCoding` | Medical Coding | LINEAR | Proposes ICD-10 / CPT / HCPCS codes from documentation. Always requires certified-coder review. |
| 5 | `ClaimScrubSubmit` | Claim Scrubbing & Submission | LINEAR | Validates claims against payer rules, scores readiness, and submits when ready. |
| 6 | `DenialPrediction` | Denial Prediction | LINEAR | Scores denial probability before submission; catches patterns beyond rule-based scrubbing. |
| 7 | `DenialManagement` | Denial Management & Appeals | LINEAR | Classifies denials, selects appeal strategies, drafts appeals, tracks recovery. |
| 8 | `PaymentPosting` | Payment Posting & Reconciliation | LINEAR | Posts payments and detects underpayments against contracted rates. |
| 9 | `PatientBilling` | Patient Billing & Collections | LINEAR | Generates estimates and statements; manages collection follow-up (Arabic & English). |
| 10 | `FraudWasteAbuse` | Fraud, Waste & Medical Necessity | SENTINEL | Cross-cutting sentinel for upcoding, unbundling, phantom billing, and medical-necessity issues. |
| 11 | `PayerContractRules` | Payer Contract & Rules | KNOWLEDGE | Queryable knowledge service: fee schedules, auth requirements, edit libraries, appeal rules. |
| 12 | `AnalyticsReporting` | Analytics & Reporting | ANALYTICS | Computes KPIs, produces trend narratives, and performs root-cause analysis. |

**Categories**

- **LINEAR** — the sequential revenue-cycle pipeline (agents 1–9).
- **SENTINEL** — `FraudWasteAbuse`, a cross-cutting monitor invoked at high-risk points (e.g., high-value claims at submission).
- **KNOWLEDGE** — `PayerContractRules`, the contract/rule knowledge base behind the engine's payer rule book.
- **ANALYTICS** — `AnalyticsReporting`, KPI and trend computation.

---

## Architecture Overview

The platform is a layered Next.js (App Router) application. The **RCM engine is pure** (no side effects): it takes a claim snapshot and returns a proposed result. The **service layer** owns persistence, audit logging, and webhook dispatch.

```
┌──────────────────────────────────────────────────────────────────┐
│  UI  (Next.js App Router, React 19, Tailwind v4 + shadcn/ui)      │
│  Dashboard · Agents · Claims · Ingestion · Escalations · Audit ·  │
│  Payer Rules · Analytics · AI Chat · Settings   (EN / AR + RTL)   │
└───────────────┬──────────────────────────────────────────────────┘
                │  fetch
┌───────────────▼──────────────────────────────────────────────────┐
│  API LAYER  (route handlers)                                      │
│  Internal/UI:  /api/claims, /api/escalations, /api/audit, ...     │
│  External v1:  /api/v1/claims, /api/v1/eligibility, /api/v1/fhir, │
│                /api/v1/webhooks, /api/v1/keys  (API-key auth)     │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  SERVICE LAYER  (src/lib/server/*)                                │
│  claim-service · auth · audit · webhooks                          │
│  Persistence · audit logging · event dispatch                    │
└───────┬──────────────────────────────┬───────────────────────────┘
        │                              │
┌───────▼─────────────────┐   ┌────────▼──────────────────────────┐
│  RCM ENGINE (pure)      │   │  PRISMA + SQLite                  │
│  src/lib/rcm-engine.ts  │   │  Claim · AgentStatus · Escalation │
│  state machine · scores │   │  KPIRecord · AuditLog · ClaimEvent│
│  payer rules · HITL     │   │  ApiKey · Webhook · WebhookDelivery│
└─────────────────────────┘   └───────────────────────────────────┘
        │  outbound events (HMAC-signed)
        ▼
   External subscribers (webhooks)
```

The claim lifecycle state machine:

```mermaid
stateDiagram-v2
    [*] --> ELIGIBILITY
    ELIGIBILITY --> PRIOR_AUTH
    PRIOR_AUTH --> CHARGE_CAPTURE
    CHARGE_CAPTURE --> CODING
    CODING --> SCRUBBING
    SCRUBBING --> SCRUBBING: dirty claim held (REVIEW)
    SCRUBBING --> SUBMITTED: clean
    SUBMITTED --> ADJUDICATION
    ADJUDICATION --> REMITTANCE: approved
    ADJUDICATION --> DENIED: denied
    REMITTANCE --> PAID
    DENIED --> SUBMITTED: appeal filed
    DENIED --> WRITTEN_OFF: write-off (APPROVE)
    PAID --> [*]
    WRITTEN_OFF --> [*]
    CLOSED --> [*]
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data model, scoring rules, payer rule book, HITL governance model, and event/webhook flow.

---

## Quick Start

Prerequisites: [Bun](https://bun.sh).

**One command (fresh clone):**

```bash
./scripts/setup.sh      # copies .env, installs, generates client, migrates, seeds
bun run dev             # http://localhost:3000
```

**Or step by step:**

```bash
# 1. Configure environment (DATABASE_URL etc.)
cp .env.example .env

# 2. Install dependencies
bun install

# 3. Generate the Prisma client
bunx prisma generate

# 4. Create the database schema (migrations)
bunx prisma migrate deploy     # or, for quick local dev: bunx prisma db push

# 5. Seed demo data
#    (12 agents, 25 claims, 10 escalations, 12 KPIs, 20 audit entries, 5 RBAC users)
bun run prisma/seed.ts

# 6. Run in development (port 3000)
bun run dev
```

Then open <http://localhost:3000>. The interactive API docs are at <http://localhost:3000/docs> and the OpenAPI spec at <http://localhost:3000/api/openapi.json>.

For a production build:

```bash
bun run build     # next build (standalone output)
bun run start     # serves the standalone server
```

---

## Scripts

Defined in `package.json`:

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev -p 3000` | Development server on port 3000 (logs to `dev.log`). |
| `build` | `next build` (+ copies static assets into `.next/standalone`) | Production standalone build. |
| `start` | `bun .next/standalone/server.js` | Run the standalone production server. |
| `lint` | `eslint .` | Lint the codebase. |
| `typecheck` | `tsc --noEmit` | Type-check the codebase (build errors are **not** ignored). |
| `test` | `bun test` | Run the Bun test suite (30 tests: engine, validation, sessions). |
| `db:push` | `prisma db push` | Sync the Prisma schema to the database. |
| `db:generate` | `prisma generate` | Generate the Prisma client. |
| `db:migrate` | `prisma migrate dev` | Create/apply a dev migration. |
| `db:reset` | `prisma migrate reset` | Reset the database. |
| `db:seed` | `bun run prisma/seed.ts` | Seed demo data. |

---

## AI Providers

The AI assistant (`POST /api/chat`) and PDF claim extraction (`POST /api/ingest`) run through a **provider-agnostic router** (`src/lib/ai`). The active provider is selected at runtime (persisted in the DB) or via env, and an automatic **failover chain** keeps the feature available when a provider is down.

| Provider | `id` | Notes |
|----------|------|-------|
| **Z.ai** (bundled SDK) | `zai` | Zero-config default — no API key required. |
| **OpenAI-compatible** | `openai` | Any OpenAI-style `/chat/completions` endpoint: OpenAI, Groq, Together, OpenRouter, vLLM, LM Studio. |
| **Anthropic Claude** | `anthropic` | Claude Messages API (chat + document/vision). |
| **Local (Ollama)** | `ollama` | Local models via Ollama's OpenAI-compatible endpoint — no API key. |

- **Failover chain.** Each chat/extraction request walks `active → fallbacks → deterministic fallback`. Fallbacks come from `RCM_AI_FALLBACKS` or, if unset, are auto-derived from every other *configured* provider. If **every** provider fails, the platform returns a deterministic knowledge-base answer so the feature never hard-fails.
- **Runtime switching.** `GET /api/ai` lists providers, the active one, the resolved chain, and per-provider config status. `POST /api/ai` switches the active provider (requires the `ai.manage` capability) and `POST /api/ai/test` runs a connectivity check. **Settings → "AI Models"** drives all of this from the UI.
- **Provenance.** Chat and ingest responses report the `provider` and `model` that produced them.

Configure providers via env (see [Environment Variables](#environment-variables)); the active provider can also be set with `RCM_AI_PROVIDER` and overridden generically with `RCM_AI_MODEL` / `RCM_AI_BASE_URL` / `RCM_AI_API_KEY`.

---

## Access Control (RBAC)

An optional sign-in gate enforces **role-based access control**. Routes and the UI check *capabilities* (not roles directly), so the policy can evolve without touching call sites (`src/lib/server/rbac.ts`).

**Role → capability matrix**

| Capability | ADMIN | RCM_MANAGER | BILLER | COMPLIANCE | VIEWER |
|------------|:-----:|:-----------:|:------:|:----------:|:------:|
| `claims.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `claims.create` | ✅ | ✅ | ✅ | — | — |
| `claims.process` | ✅ | ✅ | ✅ | — | — |
| `escalation.acknowledge` | ✅ | ✅ | ✅ | ✅ | — |
| `escalation.resolve` | ✅ | ✅ | ✅ | ✅ | — |
| `escalation.resolve.l4` | ✅ | ✅ | — | ✅ | — |
| `writeoff.approve` | ✅ | ✅ | — | — | — |
| `audit.view` | ✅ | ✅ | — | ✅ | — |
| `ai.manage` | ✅ | ✅ | — | — | — |
| `keys.manage` | ✅ | — | — | — | — |
| `webhooks.manage` | ✅ | ✅ | — | — | — |
| `settings.manage` | ✅ | ✅ | — | — | — |
| `users.manage` | ✅ | — | — | — | — |

**Authentication.** The gate activates when `RCM_AUTH_ENABLED=true` **or** `RCM_UI_PASSWORD` is set. `POST /api/auth/login` authenticates against the **User** table (matched by email or name, scrypt-hashed passwords), falling back to the env single-user (`RCM_UI_USER` / `RCM_UI_PASSWORD`) as an **ADMIN** when no users exist. Sessions carry the role in a signed HttpOnly cookie. `GET /api/auth/session` returns `{ authEnabled, user, role, capabilities }`. Settings shows an **Account** card (user / role / sign-out).

**User management.** `GET /api/users` lists users and `POST /api/users` creates them — both require the `users.manage` capability (ADMIN). Passwords are never returned.

**Seeded demo users** (inert until auth is enabled; all `@veebase.health`):

| Email | Password | Role |
|-------|----------|------|
| `admin@veebase.health` | `Admin!234` | ADMIN |
| `manager@veebase.health` | `Manager!234` | RCM_MANAGER |
| `biller@veebase.health` | `Biller!234` | BILLER |
| `compliance@veebase.health` | `Comply!234` | COMPLIANCE |
| `viewer@veebase.health` | `Viewer!234` | VIEWER |

> When auth is **disabled** (the open demo default), callers are treated as an implicit ADMIN so every feature stays reachable.

---

## Database Portability

SQLite is the **zero-config default**, but the Prisma data layer is provider-agnostic. To move to a managed database, flip the datasource provider with the helper script and re-sync:

```bash
scripts/switch-db.sh postgresql        # or: mysql | sqlite
export DATABASE_URL="postgresql://user:pass@host:5432/rcm"
bunx prisma generate
bunx prisma db push                    # or: bunx prisma migrate deploy
bun run prisma/seed.ts                 # optional demo data
```

`switch-db.sh` rewrites the `provider` line in `prisma/schema.prisma`; the rest is standard Prisma. No application code changes are required.

---

## Scale-Out & Observability

- **Shared store (optional Redis).** By default rate-limit counters are in-memory (fine for a single instance). Set `REDIS_URL` to share them across instances for horizontal scale-out (`src/lib/server/kv.ts`); this requires the optional `ioredis` package. The Edge middleware remains the per-instance first-line limiter, and the Redis-backed limiter (in `requireAuth`) is authoritative when configured. **Idempotency keys are already shared** via the primary database, so retries are safe across instances regardless of Redis.
- **PHI encryption-at-rest.** Set `RCM_ENCRYPTION_KEY` to encrypt sensitive fields (national IDs) with **AES-256-GCM** at rest. Ciphertext is stored as `enc:1:…` and returned **decrypted** via the API; plaintext/legacy values pass through unchanged, so enabling encryption is backward compatible. A PII-redaction helper masks 14-digit IDs in logs (`src/lib/server/crypto-field.ts`).
- **Metrics.** `GET /api/metrics` exposes operational metrics — claim totals and by-status, collection rate, pending escalations, webhook delivery failures, and user count — as JSON, or in Prometheus exposition format with `?format=prometheus`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./db/custom.db` | Database connection. A `file:` SQLite URL is resolved to an **absolute** path at runtime (`src/lib/db.ts`) so it works identically in dev, production, and the standalone build. Set a non-`file:` URL (e.g. `postgresql://…`, `mysql://…`) to point at a managed database with no code changes. |
| `RCM_DATABASE_FILE` | — | Optional override for the SQLite file location (absolute path preferred). Takes precedence over the `file:` portion of `DATABASE_URL`. |
| `RCM_MASTER_KEY` | — | Optional trusted server-to-server key. When set, it is **always** accepted on `/api/v1` routes and carries `read`, `write`, and `admin` scopes. Also used to provision the first key when API auth is required. |
| `RCM_REQUIRE_API_AUTH` | `false` | When `true`, an API key is required on `/api/v1` even when no keys are provisioned yet (disables open bootstrap mode). Provision the first key with `RCM_MASTER_KEY`. |
| `RCM_RATE_LIMIT` | `240` | Max `/api/v1` requests allowed per window, per API key (or client IP). |
| `RCM_RATE_WINDOW_MS` | `60000` | Rate-limit window length in milliseconds (default 60s). |
| `RCM_CORS_ORIGINS` | `*` | Comma-separated CORS allow-list for `/api/v1` (with OPTIONS preflight handling). |
| `RCM_WEBHOOK_MAX_ATTEMPTS` | `3` | Max delivery attempts for outbound webhooks (bounded exponential backoff). |

### Auth & RBAC

| Variable | Default | Description |
|----------|---------|-------------|
| `RCM_AUTH_ENABLED` | `false` | When `true`, activates the sign-in gate and role enforcement (also activated implicitly by `RCM_UI_PASSWORD`). |
| `RCM_UI_USER` | `admin` | Username for the env single-user fallback. |
| `RCM_UI_PASSWORD` | — | Password for the env single-user (role ADMIN). Setting it enables the auth gate. Unset = app is open (default). |
| `RCM_SESSION_SECRET` | — | Secret used to sign the HttpOnly UI session cookie. |
| `RCM_SEED_ADMIN_PASSWORD` | `Admin!234` | Password assigned to the seeded `admin@veebase.health` user. |

### AI providers

| Variable | Default | Description |
|----------|---------|-------------|
| `RCM_AI_PROVIDER` | `zai` | Active provider: `zai` \| `openai` \| `anthropic` \| `ollama` (DB runtime selection takes precedence). |
| `RCM_AI_FALLBACKS` | — | Comma-separated failover chain (e.g. `openai,ollama`). Auto-derived from configured providers if unset. |
| `RCM_AI_TIMEOUT_MS` | `30000` | Per-request timeout for remote providers. |
| `RCM_AI_MODEL` / `RCM_AI_VISION_MODEL` | — | Generic model overrides applied to the **active** provider. |
| `RCM_AI_BASE_URL` / `RCM_AI_API_KEY` | — | Generic endpoint/key overrides applied to the **active** provider. |
| `OPENAI_API_KEY` (or `RCM_OPENAI_API_KEY`) | — | API key for the OpenAI-compatible provider. |
| `RCM_OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible base URL (point at Groq, Together, vLLM, LM Studio, …). |
| `RCM_OPENAI_MODEL` | `gpt-4o-mini` | OpenAI-compatible chat model. |
| `RCM_OPENAI_VISION_MODEL` | (= chat model) | OpenAI-compatible vision model for PDF extraction. |
| `ANTHROPIC_API_KEY` (or `RCM_ANTHROPIC_API_KEY`) | — | API key for the Anthropic provider. |
| `RCM_ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` | Anthropic chat/vision model. |
| `RCM_OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint. |
| `RCM_OLLAMA_MODEL` | `llama3.1` | Ollama chat model. |
| `RCM_OLLAMA_VISION_MODEL` | `llava` | Ollama vision model. |

### PHI encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `RCM_ENCRYPTION_KEY` | — | Enables AES-256-GCM encryption-at-rest of sensitive fields (national IDs). Use 64 hex chars for a raw 32-byte key, or any passphrase (derived via scrypt). Unset = plaintext (open demo default). |

### Scale-out (Redis)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | — | When set, enables cross-instance rate limiting via Redis (requires the optional `ioredis` package). Idempotency keys are shared via the database regardless. |

> **Note:** SQLite is the default and the schema's `datasource` provider. To use Postgres/MySQL, run `scripts/switch-db.sh postgresql` (or `mysql`) — it flips the `provider` in `prisma/schema.prisma` — then set `DATABASE_URL` and re-run `prisma generate` / `prisma db push`. See [Database Portability](#database-portability).

---

## Project Structure

```
RCM-AI/
├── prisma/
│   ├── schema.prisma        # Data model (incl. User, Setting, IdempotencyKey)
│   └── seed.ts              # Demo data seeder (+ seeded RBAC users)
├── scripts/
│   └── switch-db.sh         # Flip Prisma provider: sqlite | postgresql | mysql
├── public/
│   └── whitepaper.html      # Standalone technical & business whitepaper
├── src/
│   ├── app/
│   │   ├── api/             # Route handlers
│   │   │   ├── claims/      # Internal/UI claim APIs (+ [id]/process)
│   │   │   ├── escalations/ # Escalation queue
│   │   │   ├── audit/       # Audit trail
│   │   │   ├── agents/  kpis/  dashboard/  chat/  ingest/  health/
│   │   │   ├── openapi.json/ # OpenAPI 3.0 spec
│   │   │   └── v1/          # External API (claims, eligibility, fhir,
│   │   │                    #   webhooks, keys)
│   │   └── docs/            # Interactive Swagger UI (route handler)
│   └── lib/
│       ├── rcm-engine.ts    # Pure deterministic engine (state machine,
│       │                    #   scoring, payer rules, HITL gates)
│       ├── rcm-data.ts      # 12 agents, KPIs, appeal strategies, templates
│       ├── rcm-types.ts     # Shared types
│       ├── db.ts            # Prisma client + DB URL resolution
│       ├── ai/             # Pluggable AI router (provider config, failover)
│       │   ├── config.ts        # provider configs + env resolution
│       │   ├── providers.ts     # z.ai / OpenAI / Anthropic call impls
│       │   └── index.ts         # router: active provider + failover chain
│       ├── server/          # Service layer
│       │   ├── claim-service.ts  # create/list/update/process claims
│       │   ├── auth.ts           # API-key auth & bootstrap mode
│       │   ├── rbac.ts           # roles → capability matrix
│       │   ├── crypto-field.ts   # AES-256-GCM PHI encryption + PII redaction
│       │   ├── kv.ts             # in-memory / Redis shared store
│       │   ├── audit.ts          # immutable audit writer
│       │   └── webhooks.ts       # outbound signed event dispatch
│       └── i18n/            # English + Arabic translations, RTL
└── docs/
    ├── ARCHITECTURE.md      # System architecture deep-dive
    ├── INTEGRATION.md       # Complete integration guide
    └── API.md              # Endpoint cheat-sheet
```

---

## Integration

The platform exposes both **internal/UI** endpoints and a versioned **external `v1`** API for inbound submission and outbound events.

- **Authentication** uses an API key sent as `X-API-Key: <key>` or `Authorization: Bearer <key>`. While **no keys exist**, the gateway runs in an **open bootstrap mode**; once the first key is created via `POST /api/v1/keys`, auth is **enforced** on all `/api/v1` routes. An `RCM_MASTER_KEY` env var is always accepted.
- **Inbound:** create claims (single, batch, or HL7 FHIR R4), run the agent pipeline, and check eligibility.
- **Outbound:** register webhooks to receive HMAC-signed lifecycle events (`claim.created`, `claim.denied`, `claim.paid`, `escalation.created`, …).
- **Operations & control:** `GET /api/metrics` (JSON or Prometheus), the AI-provider control plane (`GET/POST /api/ai`, `POST /api/ai/test`), and user management (`GET/POST /api/users`, requires `users.manage`).
- **Specs:** OpenAPI 3.0 at `GET /api/openapi.json`; interactive Swagger UI at `GET /docs`.

See the full guide in [`docs/INTEGRATION.md`](docs/INTEGRATION.md) and the endpoint cheat-sheet in [`docs/API.md`](docs/API.md).

---

## Security & Governance

- **Human-in-the-Loop (HITL) gates** — every agent step carries a gate of `AUTO`, `REVIEW`, or `APPROVE`. Automated processing (`processToGate`) advances only through `AUTO` steps and **stops** the moment a step requires a human.
- **Prohibited actions are never auto-executed.** Enforced by the Phase-1 governance model:
  - No auto-accept of low-confidence coding — routed to a certified coder (`REVIEW`).
  - No auto write-off — write-offs require human approval (`APPROVE`).
  - Dirty claims (failed scrubber edits) are **held** at scrubbing, never submitted.
  - High-value claims (> 50,000 EGP) are flagged to the Fraud/Waste/Abuse sentinel and gated to `APPROVE` before submission.
- **Immutable audit trail** — every create, status change, agent run, escalation, and HITL action is appended to `AuditLog` with actor, role, risk level, before/after values, and source (`ui` / `api` / `engine` / `webhook`). The Audit Trail UI supports CSV export.
- **API-key scopes** — `read`, `write`, `admin`. Key secrets are stored only as SHA-256 hashes and shown in plaintext exactly once at creation. Webhook signing secrets are likewise returned once.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#human-in-the-loop-governance) for the complete governance model.

### Production Hardening

- **Request validation (Zod)** — every `/api/v1` write endpoint validates its body and returns **HTTP 422** with `{ error: "Validation failed", issues: [{ path, message }] }` on bad input. Claim create accepts a single object, a raw array, or `{ claims: [...] }`.
- **Rate limiting** — per API key (or client IP) token bucket on `/api/v1`, default **240 requests / 60s** (configurable via `RCM_RATE_LIMIT` / `RCM_RATE_WINDOW_MS`). On exceed returns **429** with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. All API responses carry an `X-Request-Id` correlation header.
- **CORS** — configurable allow-list for `/api/v1` via `RCM_CORS_ORIGINS` (comma-separated, default `*`), with proper OPTIONS preflight handling.
- **Security headers** — applied globally via `next.config`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **Idempotency keys** — single claim create (`POST /api/v1/claims`) honors an `Idempotency-Key` request header; repeating the same key (scoped per API key) returns the original claim instead of creating a duplicate.
- **Webhook reliability** — deliveries retry with bounded exponential backoff (default 3 attempts, `RCM_WEBHOOK_MAX_ATTEMPTS`) and run in the background so they never block the API response. Inspect recent attempts via `GET /api/v1/webhooks/{id}/deliveries` and send a signed `ping` via `POST /api/v1/webhooks/{id}/test`.
- **Configurable API auth** — set `RCM_REQUIRE_API_AUTH=true` to require an API key on `/api/v1` even before any key is provisioned (disables open bootstrap mode); provision the first key with `RCM_MASTER_KEY`.
- **Optional UI auth gate + RBAC** — when `RCM_AUTH_ENABLED=true` or `RCM_UI_PASSWORD` is set, the dashboard requires login (`/login` page, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, HttpOnly signed-cookie session). Sessions carry one of five roles; internal routes enforce a capability matrix (see [Access Control (RBAC)](#access-control-rbac)). Unset = open by default.
- **PHI encryption-at-rest** — set `RCM_ENCRYPTION_KEY` to AES-256-GCM-encrypt sensitive fields (national IDs); ciphertext is stored as `enc:1:…` and returned decrypted, backward-compatible with existing plaintext rows. A redaction helper masks 14-digit IDs in logs.
- **Pluggable AI with failover** — chat/extraction route through z.ai / OpenAI-compatible / Anthropic / Ollama with an automatic fallback chain and a deterministic final fallback; switch at runtime via `POST /api/ai` (`ai.manage`). See [AI Providers](#ai-providers).
- **Database portability** — `scripts/switch-db.sh sqlite|postgresql|mysql` retargets the Prisma datasource for a managed DB with no code changes.
- **Scale-out shared store** — set `REDIS_URL` for cross-instance rate limiting (optional `ioredis`); idempotency keys are already DB-shared.
- **Operational metrics** — `GET /api/metrics` exposes claims/escalations/webhook/user metrics as JSON or Prometheus (`?format=prometheus`).
- **Automated tests + CI** — the codebase type-checks cleanly (`ignoreBuildErrors` is off), ships a Bun test suite (`bun test`), and a GitHub Actions workflow (`.github/workflows/ci.yml`) runs install → prisma generate → db push → lint → typecheck → test → build.

---

## Internationalization (i18n / RTL)

The UI ships with **English** and **Arabic** translations and a full **right-to-left** layout flip. The selected locale is persisted to `localStorage` (`veebase-locale`) and applied via `document.documentElement.dir` / `lang`. The implementation is a lightweight custom context provider (`src/lib/i18n`).

---

## License

MIT.
