# API Cheat-Sheet

A concise reference of **every** endpoint in the Veebase RCM Intelligence Platform. For full request/response examples, authentication, and webhooks, see [`INTEGRATION.md`](INTEGRATION.md).

- **Internal/UI** endpoints (`/api/*`) back the application UI and require no API key. When the UI auth gate is enabled, a handful enforce an **RBAC capability** (shown in the **Auth** column, e.g. `ai.manage`, `users.manage`); the rest are open. With auth disabled, callers act as an implicit ADMIN and all capabilities pass.
- **External v1** endpoints (`/api/v1/*`) require API-key auth (`X-API-Key` or `Authorization: Bearer`) once the gateway is out of bootstrap mode. The **Auth** column shows the required scope.

## Internal / UI API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/health` | none | Liveness/readiness probe (DB status, claim count, latency). |
| `GET` | `/api/claims` | none | List claims with filters, pagination, and summary. |
| `POST` | `/api/claims` | none | Create a claim through the engine-scored service layer. |
| `POST` | `/api/claims/{id}/process` | none | Run the engine on a claim. Body `{ mode: 'step' \| 'auto', actor? }` (default `step`). |
| `GET` | `/api/escalations` | none | List escalations with filters and a level/status summary. |
| `PATCH` | `/api/escalations` | none | Acknowledge or resolve an escalation. Body `{ id, action: 'acknowledge' \| 'resolve', assignedTo?, resolution? }`. |
| `GET` | `/api/audit` | none | Compliance audit trail with filters (`action`, `riskLevel`, `claimNumber`, `limit`). |
| `POST` | `/api/audit` | none | Append an audit entry (used by UI actions). |
| `GET` | `/api/agents` | none | List the 12 agents and their operational status. |
| `GET` | `/api/kpis` | none | Revenue-cycle KPI records. |
| `GET` | `/api/dashboard` | none | Aggregated dashboard data. |
| `POST` | `/api/chat` | none | AI assistant chat (active provider + failover, deterministic fallback). Response reports `provider`/`model`. |
| `POST` | `/api/ingest` | none | Upload a PDF claim for VLM extraction (multipart `file`, `template`). Response reports `provider`/`model`. |
| `GET` | `/api/ai` | none | List AI providers, the active one, the failover chain, and per-provider config status. |
| `POST` | `/api/ai` | `ai.manage` | Switch the active AI provider. Body `{ provider: 'zai'\|'openai'\|'anthropic'\|'ollama' }`. |
| `POST` | `/api/ai/test` | none | Connectivity test against a provider. Body `{ provider? }` (defaults to active). |
| `GET` | `/api/metrics` | none | Operational metrics. `?format=prometheus` returns Prometheus exposition; default is JSON. |
| `GET` | `/api/users` | `users.manage` | List users (passwords never returned) + the role list. |
| `POST` | `/api/users` | `users.manage` | Create a user. Body `{ email, name, password (≥6), role }`. |
| `GET` | `/api/openapi.json` | none | OpenAPI 3.0 specification. |
| `GET` | `/docs` | none | Interactive Swagger UI. |
| `GET` | `/api` | none | Root hello-world stub. |
| `POST` | `/api/auth/login` | none | UI auth gate login. Body `{ username\|email, password }` → sets an HttpOnly signed-cookie session carrying the role. |
| `POST` | `/api/auth/logout` | none | Clear the UI session cookie. |
| `GET` | `/api/auth/session` | none | Return `{ authEnabled, user, role, capabilities }`. |

## External v1 API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/claims` | `read` | List claims (filters, pagination, summary). |
| `POST` | `/api/v1/claims` | `write` | Create one claim, or a batch (`{ claims: [...] }` or a raw array). |
| `GET` | `/api/v1/claims/{idOrNumber}` | `read` | Fetch a claim with its processing history. |
| `PATCH` | `/api/v1/claims/{idOrNumber}` | `write` | Update mutable claim fields. |
| `POST` | `/api/v1/claims/{idOrNumber}/process` | `write` | Run the agent pipeline. Body `{ mode: 'step' \| 'auto' }` (default `auto`). |
| `POST` | `/api/v1/eligibility` | `read` | Real-time eligibility & risk pre-check (no persistence). |
| `POST` | `/api/v1/fhir/Claim` | `write` | Ingest an HL7 FHIR R4 `Claim` resource. |
| `GET` | `/api/v1/fhir/Claim/{idOrNumber}` | `read` | Read a claim as a FHIR R4 `Claim` resource. |
| `GET` | `/api/v1/webhooks` | `read` | List webhook subscriptions. |
| `POST` | `/api/v1/webhooks` | `write` | Register a webhook (returns signing secret once). |
| `PATCH` | `/api/v1/webhooks/{id}` | `write` | Enable/disable or update a webhook's events/description. |
| `DELETE` | `/api/v1/webhooks/{id}` | `write` | Remove a webhook subscription. |
| `POST` | `/api/v1/webhooks/{id}/test` | `write` | Send a signed `ping` event to the webhook. |
| `GET` | `/api/v1/webhooks/{id}/deliveries` | `read` | List recent delivery attempts (`status`, `statusCode`, `attempts`). |
| `GET` | `/api/v1/keys` | `read` | List API keys (secrets never returned). |
| `POST` | `/api/v1/keys` | `write` | Provision a new API key (returns secret once). First key works under bootstrap mode. |

> **Headers on `/api/v1`:** all responses include an `X-Request-Id` correlation header plus rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; a `Retry-After` is added on **429**). Single claim create (`POST /api/v1/claims`) honors an `Idempotency-Key` request header — repeating a key (scoped per API key) returns the original claim. See [`INTEGRATION.md`](INTEGRATION.md#reliability--limits).

## Webhook Events

`claim.created` · `claim.updated` · `claim.status_changed` · `claim.submitted` · `claim.denied` · `claim.paid` · `claim.written_off` · `escalation.created` · `escalation.resolved` · `agent.run`

Delivered with headers `X-RCM-Event`, `X-RCM-Signature` (`sha256=` HMAC-SHA256 of the raw body), and `X-RCM-Delivery`.

## Auth Quick Reference

| | |
|---|---|
| Header | `X-API-Key: <key>` or `Authorization: Bearer <key>` |
| Bootstrap | Open (no key required) until the first key is created. |
| Master key | `RCM_MASTER_KEY` env var, always accepted (`read`+`write`+`admin`). |
| Scopes | `read`, `write`, `admin` (admin implies all). |
