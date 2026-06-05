# Integration Guide

The complete guide to integrating with the **Veebase RCM Intelligence Platform** — authentication and bootstrap, the full `/api/v1` endpoint reference, batch ingestion, HL7 FHIR R4, webhooks (with signature verification), eligibility pre-checks, an end-to-end walkthrough, and error handling.

Throughout, the base URL placeholder is **`https://rcm.example.com`**. Replace it with your deployment (e.g. `http://localhost:3000` in development).

## Table of Contents

- [Authentication & Bootstrap](#authentication--bootstrap)
- [Authentication Modes](#authentication-modes)
- [Scopes](#scopes)
- [Conventions](#conventions)
- [Reliability & Limits](#reliability--limits)
- [API Keys](#api-keys)
- [Claims](#claims)
  - [Create a claim](#create-a-claim)
  - [Batch ingestion](#batch-ingestion)
  - [List claims](#list-claims)
  - [Get a claim](#get-a-claim)
  - [Update a claim](#update-a-claim)
  - [Process a claim](#process-a-claim)
- [Eligibility Pre-Check](#eligibility-pre-check)
- [FHIR R4](#fhir-r4)
- [Webhooks](#webhooks)
  - [Subscribe](#subscribe-to-a-webhook)
  - [Manage](#manage-webhooks)
  - [Verifying signatures](#verifying-webhook-signatures)
- [End-to-End Walkthrough](#end-to-end-walkthrough)
- [Error Codes](#error-codes)
- [OpenAPI & Swagger](#openapi--swagger)

---

## Authentication & Bootstrap

All `/api/v1/*` routes are protected by API-key authentication. Provide your key in **either** header:

```
X-API-Key: rcm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

or

```
Authorization: Bearer rcm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Bootstrap mode.** When **no API keys exist yet**, the gateway runs in **open bootstrap mode** — requests succeed without credentials (with `read`+`write` scopes) so you can provision the first key. The moment you create the first key via `POST /api/v1/keys`, **authentication is enforced** on every `/api/v1` route.

**Master key.** If the server is started with `RCM_MASTER_KEY` set, that exact value is **always** accepted (as `X-API-Key` or Bearer) and carries `read`, `write`, and `admin` scopes. Use it for trusted server-to-server callers.

```mermaid
flowchart TD
    A[Inbound /api/v1 request] --> B{RCM_MASTER_KEY set<br/>and matches?}
    B -- yes --> M[Authenticated<br/>scopes: read, write, admin]
    B -- no --> C{Any active API keys exist?}
    C -- no --> D[Open bootstrap mode<br/>scopes: read, write]
    C -- yes --> E{Valid key provided?}
    E -- yes --> F[Authenticated<br/>scopes from key]
    E -- no --> G[401 Unauthorized]
```

---

## Authentication Modes

### API auth (`/api/v1`)

By default, `/api/v1` runs in **open bootstrap mode** until the first key is provisioned (see above). To require a key from the very first request — even before any key exists — start the server with **`RCM_REQUIRE_API_AUTH=true`**. This disables the open bootstrap path, so unauthenticated requests get **401**. Provision the first key using the trusted **`RCM_MASTER_KEY`** value (always accepted, `read`+`write`+`admin`):

```bash
curl -X POST https://rcm.example.com/api/v1/keys \
  -H "X-API-Key: $RCM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{ "name": "EHR Integration", "scopes": ["read","write"] }'
```

### Optional UI auth gate

The dashboard is **open by default**. Set **`RCM_UI_PASSWORD`** (with optional **`RCM_UI_USER`**, default `admin`, and **`RCM_SESSION_SECRET`** to sign the session cookie) to require login. The gate is enforced for the UI only; `/api/v1` remains protected separately by API keys.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/auth/login` | `{ username, password }` | On success, sets an HttpOnly signed-cookie session. |
| `POST` | `/api/auth/logout` | — | Clears the session cookie. |
| `GET` | `/api/auth/session` | — | Returns the current session state. |

A `/login` page is served for interactive sign-in. **Public paths** that bypass the gate even when a password is set: `/login`, `/api/auth/*`, `/api/v1/*` (key-protected separately), `/api/health`, `/api/openapi.json`, and `/docs`.

---

## Scopes

| Scope | Grants |
|-------|--------|
| `read` | `GET` endpoints, eligibility pre-check. |
| `write` | Create/update/process claims, register/manage webhooks, create keys. |
| `admin` | Implies all scopes — any scope check passes. |

A key created with no scopes defaults to `["read","write"]`. A missing required scope returns **403 Forbidden**.

---

## Conventions

- All request and response bodies are JSON (`Content-Type: application/json`), except FHIR endpoints which use `application/fhir+json` for responses.
- Monetary amounts are in **EGP**.
- `payerType` is one of `NHIA`, `PRIVATE`, `SELF_PAY`.
- Claim `status` is one of `ELIGIBILITY`, `PRIOR_AUTH`, `CHARGE_CAPTURE`, `CODING`, `SCRUBBING`, `SUBMITTED`, `ADJUDICATION`, `REMITTANCE`, `DENIED`, `PAID`, `CLOSED`, `WRITTEN_OFF`.
- A claim can be addressed by its `id` **or** its `claimNumber` in path parameters.

---

## Reliability & Limits

### Request validation (422)

All `/api/v1` **write** endpoints validate their request body (Zod). On invalid input they return **HTTP 422** with a structured list of issues:

```json
{
  "error": "Validation failed",
  "issues": [
    { "path": "patientName", "message": "Required" },
    { "path": "totalAmount", "message": "Expected number, received string" }
  ]
}
```

Claim create accepts a single object, a raw array, or `{ "claims": [...] }` — all three shapes are validated the same way.

### Rate limiting (429)

`/api/v1` enforces a per-API-key (or per-client-IP) token bucket. The default is **240 requests / 60s**, configurable via `RCM_RATE_LIMIT` and `RCM_RATE_WINDOW_MS`. Every API response includes an **`X-Request-Id`** correlation header and the current rate-limit headers; when the limit is exceeded the request is rejected with **429**.

| Header | On | Meaning |
|--------|----|---------|
| `X-Request-Id` | all responses | Correlation id for the request. |
| `X-RateLimit-Limit` | all `/api/v1` responses | Max requests per window. |
| `X-RateLimit-Remaining` | all `/api/v1` responses | Requests left in the current window. |
| `X-RateLimit-Reset` | all `/api/v1` responses | When the window resets. |
| `Retry-After` | `429` only | Seconds to wait before retrying. |

### CORS

Cross-origin access to `/api/v1` is governed by **`RCM_CORS_ORIGINS`** — a comma-separated allow-list (default `*`). OPTIONS preflight requests are answered with the appropriate CORS headers.

### Idempotency keys

To make claim creation safe to retry, send an **`Idempotency-Key`** header on a single `POST /api/v1/claims`. Repeating the **same** key (scoped per API key) returns the **original** claim instead of creating a duplicate.

```bash
# First call — creates the claim.
curl -X POST https://rcm.example.com/api/v1/claims \
  -H "X-API-Key: $RCM_KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: claim-2026-05-01-ahmed-8500" \
  -d '{ "patientName": "Ahmed Mohamed Hassan", "payerType": "NHIA", "totalAmount": 8500 }'

# Same key again — returns the SAME claim, no duplicate created.
curl -X POST https://rcm.example.com/api/v1/claims \
  -H "X-API-Key: $RCM_KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: claim-2026-05-01-ahmed-8500" \
  -d '{ "patientName": "Ahmed Mohamed Hassan", "payerType": "NHIA", "totalAmount": 8500 }'
```

### Webhook reliability

Outbound deliveries **retry with bounded exponential backoff** (default 3 attempts, configurable via `RCM_WEBHOOK_MAX_ATTEMPTS`) and run **in the background**, so they never block the API response. Each delivered request also carries an **`X-RCM-Attempt`** header. See [Webhooks](#webhooks) for the test and delivery-log endpoints.

---

## API Keys

### Provision a key

`POST /api/v1/keys` — requires `write` scope (or runs under bootstrap mode for the first key). The plaintext secret is returned **exactly once** and only its SHA-256 hash is stored.

**Request body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Human-readable label. |
| `scopes` | string[] | no | Defaults to `["read","write"]`. |

```bash
curl -X POST https://rcm.example.com/api/v1/keys \
  -H "Content-Type: application/json" \
  -d '{ "name": "EHR Integration", "scopes": ["read", "write"] }'
```

**Response `201`**

```json
{
  "id": "clx...",
  "name": "EHR Integration",
  "secret": "rcm_live_3f9a...c1",
  "prefix": "rcm_live_3f",
  "scopes": ["read", "write"],
  "note": "Store this secret securely — it will not be shown again. Send it as the X-API-Key header."
}
```

### List keys

`GET /api/v1/keys` — requires `read`. Secrets are never returned; only `prefix`, scopes, `active`, and `lastUsedAt`.

```bash
curl https://rcm.example.com/api/v1/keys -H "X-API-Key: $RCM_KEY"
```

---

## Claims

### Create a claim

`POST /api/v1/claims` — requires `write`. Submit a single claim object. The claim is created at status `ELIGIBILITY` (unless `status` is supplied), scored by the engine, and a `claim.created` event is emitted.

**Request body**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `patientName` | string | **yes** | — |
| `totalAmount` | number | **yes** | — |
| `nationalId` | string | no | `""` |
| `patientId` | string | no | `PAT-<seq>` |
| `encounterId` | string | no | `ENC-<seq>` |
| `payerId` | string | no | `payerType` |
| `payerName` | string | no | derived from `payerType` |
| `payerType` | `NHIA`\|`PRIVATE`\|`SELF_PAY` | no | `PRIVATE` |
| `serviceDate` | ISO date string | no | now |
| `priorAuthRequired` | boolean | no | `false` |
| `priorAuthNumber` | string | no | — |
| `tags` | string[] | no | `[]` |
| `status` | claim status | no | `ELIGIBILITY` |

```bash
curl -X POST https://rcm.example.com/api/v1/claims \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "patientName": "Ahmed Mohamed Hassan",
        "nationalId": "29001011234567",
        "payerType": "NHIA",
        "payerName": "NHIA - Universal Health Insurance",
        "serviceDate": "2026-05-01",
        "totalAmount": 8500,
        "priorAuthRequired": true,
        "priorAuthNumber": "AUTH-45231"
      }'
```

**Response `201`**

```json
{
  "claim": {
    "id": "clx...",
    "claimNumber": "CLM-2026-0026",
    "patientName": "Ahmed Mohamed Hassan",
    "payerType": "NHIA",
    "totalAmount": 8500,
    "status": "ELIGIBILITY",
    "readinessScore": 85,
    "denialRiskScore": 8,
    "priorAuthRequired": true,
    "priorAuthStatus": "APPROVED",
    "hitlGate": "REVIEW",
    "tags": [],
    "createdAt": "2026-06-05T10:00:00.000Z"
  }
}
```

### Batch ingestion

`POST /api/v1/claims` also accepts a **batch**: either a raw JSON array of claim objects, or an object `{ "claims": [...] }`. Each item is validated (`patientName` and numeric `totalAmount` required); valid items are created and invalid ones are reported by index.

```bash
curl -X POST https://rcm.example.com/api/v1/claims \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "claims": [
          { "patientName": "Fatma Ali",   "payerType": "NHIA",    "totalAmount": 3200 },
          { "patientName": "Omar Youssef", "payerType": "PRIVATE", "totalAmount": 12500 },
          { "totalAmount": 900 }
        ]
      }'
```

**Response `201`** (or `400` if *every* item failed)

```json
{
  "created": [ { "claimNumber": "CLM-2026-0027", "...": "..." },
               { "claimNumber": "CLM-2026-0028", "...": "..." } ],
  "createdCount": 2,
  "errors": [ { "index": 2, "error": "patientName and numeric totalAmount are required" } ]
}
```

### List claims

`GET /api/v1/claims` — requires `read`. Returns paginated claims plus a summary.

**Query parameters:** `status`, `payerType`, `payerId`, `minAmount`, `maxAmount`, `tag`, `search` (matches patient name / claim number / payer name), `page` (default 1), `limit` (default 50).

```bash
curl "https://rcm.example.com/api/v1/claims?payerType=NHIA&minAmount=5000&page=1&limit=20" \
  -H "X-API-Key: $RCM_KEY"
```

**Response `200`**

```json
{
  "claims": [ { "claimNumber": "CLM-2026-0026", "...": "..." } ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 },
  "summary": {
    "totalClaims": 8,
    "totalAmount": 184200.00,
    "totalPaid": 96400.00,
    "avgReadinessScore": 83,
    "avgDenialRiskScore": 21,
    "statusDistribution": { "ELIGIBILITY": 3, "SUBMITTED": 2, "PAID": 3 }
  }
}
```

### Get a claim

`GET /api/v1/claims/{idOrNumber}` — requires `read`. Returns the claim plus its processing `history` (the recorded `ClaimEvent`s).

```bash
curl https://rcm.example.com/api/v1/claims/CLM-2026-0026 \
  -H "X-API-Key: $RCM_KEY"
```

**Response `200`**

```json
{
  "claim": { "claimNumber": "CLM-2026-0026", "status": "SUBMITTED", "...": "..." },
  "history": [
    { "agent": "EligibilityBenefits", "from": "ELIGIBILITY", "to": "PRIOR_AUTH",
      "confidence": "HIGH", "hitlGate": "AUTO",
      "rationale": "Coverage verified with NHIA ...", "at": "2026-06-05T10:01:00.000Z" }
  ]
}
```

Returns `404` if the claim does not exist.

### Update a claim

`PATCH /api/v1/claims/{idOrNumber}` — requires `write`. Updates mutable fields only: `payerName`, `payerType`, `totalAmount`, `priorAuthRequired`, `priorAuthNumber`, `priorAuthStatus`, `status`, `tags`. An audit entry (`AGENT_OVERRIDE`) is written and a `claim.updated` event is emitted.

```bash
curl -X PATCH https://rcm.example.com/api/v1/claims/CLM-2026-0026 \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "priorAuthNumber": "AUTH-99887", "priorAuthStatus": "APPROVED" }'
```

### Process a claim

`POST /api/v1/claims/{idOrNumber}/process` — requires `write`. Runs the autonomous RCM agents on the claim.

**Request body**

| Field | Type | Default | Behavior |
|-------|------|---------|----------|
| `mode` | `"step"` \| `"auto"` | `"auto"` | `step`: advance exactly one stage. `auto`: advance until a human gate, a terminal status, or the safety cap. |

**Step mode**

```bash
curl -X POST https://rcm.example.com/api/v1/claims/CLM-2026-0026/process \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "mode": "step" }'
```

```json
{
  "claim": { "status": "PRIOR_AUTH", "...": "..." },
  "result": {
    "agent": "EligibilityBenefits",
    "from": "ELIGIBILITY",
    "to": "PRIOR_AUTH",
    "confidence": "HIGH",
    "hitlGate": "AUTO",
    "rationale": "Coverage verified with NHIA ...",
    "output": { "eligibilityStatus": "ACTIVE", "priorAuthRequired": true },
    "escalation": null
  }
}
```

**Auto mode** — stops at the first human gate (the platform never auto-bypasses `REVIEW`/`APPROVE`):

```bash
curl -X POST https://rcm.example.com/api/v1/claims/CLM-2026-0026/process \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "mode": "auto" }'
```

```json
{
  "claim": { "status": "SUBMITTED", "...": "..." },
  "stepsRun": 5,
  "steps": [
    { "agent": "EligibilityBenefits", "from": "ELIGIBILITY", "to": "PRIOR_AUTH", "hitlGate": "AUTO" },
    { "agent": "PriorAuthorization", "from": "PRIOR_AUTH", "to": "CHARGE_CAPTURE", "hitlGate": "AUTO" },
    { "agent": "ChargeCapture", "from": "CHARGE_CAPTURE", "to": "CODING", "hitlGate": "AUTO" },
    { "agent": "MedicalCoding", "from": "CODING", "to": "SCRUBBING", "hitlGate": "AUTO" },
    { "agent": "ClaimScrubSubmit", "from": "SCRUBBING", "to": "SUBMITTED", "hitlGate": "AUTO" }
  ],
  "stoppedAt": "SUBMITTED",
  "requiresHuman": false
}
```

If a step raises an escalation, it appears as `escalation: { id, level, reason }` on that step.

---

## Eligibility Pre-Check

`POST /api/v1/eligibility` — requires `read`. A real-time eligibility and risk pre-check that **does not persist** a claim. Ideal at registration/scheduling.

**Request body:** `payerType` (default `PRIVATE`), `totalAmount`, optional `priorAuthNumber`, `serviceDate`, `patientName`.

```bash
curl -X POST https://rcm.example.com/api/v1/eligibility \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "payerType": "NHIA", "totalAmount": 7000 }'
```

**Response `200`**

```json
{
  "eligible": true,
  "coverageType": "NHIA",
  "priorAuthRequired": true,
  "priorAuthThreshold": 5000,
  "filingDays": 90,
  "estimatedReimbursement": 6300,
  "estimatedPatientResponsibility": 0,
  "readinessScore": 60,
  "denialRiskScore": 33,
  "recommendation": "Obtain prior authorization before service to avoid denial."
}
```

---

## FHIR R4

For EHR/HIS systems that speak HL7 FHIR. A pragmatic subset of the FHIR R4 `Claim` resource is mapped to the platform's claim model.

### Ingest a FHIR Claim

`POST /api/v1/fhir/Claim` — requires `write`. Body must be a resource with `"resourceType": "Claim"`.

**Mapping** (read from the resource): `patient.display` → patient name; `patient.identifier.value` → national id; `total.value` (or `total.amount.value`) → total amount; `insurance[0].coverage.display` → payer name (payer type inferred — names containing "nhia"/"national health" → `NHIA`, "self"/"cash" → `SELF_PAY`, else `PRIVATE`); `billablePeriod.start` (or `created`) → service date; `insurance[0].preAuthRef[0]` → prior auth number (and sets `priorAuthRequired`).

```bash
curl -X POST https://rcm.example.com/api/v1/fhir/Claim \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/fhir+json" \
  -d '{
        "resourceType": "Claim",
        "status": "active",
        "use": "claim",
        "patient": {
          "display": "Yasmin Hassan Ahmed",
          "identifier": { "value": "28506071234567" }
        },
        "billablePeriod": { "start": "2026-05-10" },
        "insurance": [{
          "sequence": 1, "focal": true,
          "coverage": { "display": "NHIA - Universal Health Insurance" },
          "preAuthRef": ["AUTH-78432"]
        }],
        "total": { "value": 24000, "currency": "EGP" }
      }'
```

**Response `201`** (`application/fhir+json`, with a `Location` header pointing at the read endpoint):

```json
{
  "resourceType": "Claim",
  "id": "clx...",
  "identifier": [{ "system": "urn:veebase:claim", "value": "CLM-2026-0029" }],
  "status": "active",
  "use": "claim",
  "patient": { "display": "Yasmin Hassan Ahmed", "identifier": { "value": "28506071234567" } },
  "billablePeriod": { "start": "2026-05-10T00:00:00.000Z" },
  "insurance": [{ "sequence": 1, "focal": true,
                  "coverage": { "display": "NHIA - Universal Health Insurance" },
                  "preAuthRef": ["AUTH-78432"] }],
  "total": { "value": 24000, "currency": "EGP" },
  "extension": [{ "url": "urn:veebase:rcm-status", "valueString": "ELIGIBILITY" }]
}
```

A non-`Claim` body returns `400` with a FHIR `OperationOutcome`.

### Read a claim as FHIR

`GET /api/v1/fhir/Claim/{idOrNumber}` — requires `read`. Returns the claim as a FHIR R4 `Claim` resource (or a `404` `OperationOutcome`).

```bash
curl https://rcm.example.com/api/v1/fhir/Claim/CLM-2026-0029 \
  -H "X-API-Key: $RCM_KEY"
```

---

## Webhooks

Subscribe a URL to receive HMAC-signed lifecycle events. Available events: `claim.created`, `claim.updated`, `claim.status_changed`, `claim.submitted`, `claim.denied`, `claim.paid`, `claim.written_off`, `escalation.created`, `escalation.resolved`, `agent.run`.

### Subscribe to a webhook

`POST /api/v1/webhooks` — requires `write`. Returns the **signing secret once**.

**Request body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `url` | string | **yes** | Destination URL. |
| `events` | string[] | no | Specific events, or omit/`["*"]` for all. |
| `description` | string | no | — |

```bash
curl -X POST https://rcm.example.com/api/v1/webhooks \
  -H "X-API-Key: $RCM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-system.example.com/hooks/rcm",
        "events": ["claim.denied", "claim.paid", "escalation.created"],
        "description": "Billing system event sink"
      }'
```

**Response `201`**

```json
{
  "id": "clx...",
  "url": "https://your-system.example.com/hooks/rcm",
  "events": ["claim.denied", "claim.paid", "escalation.created"],
  "secret": "whsec_4f2a...e9",
  "note": "Store this secret securely. Payloads are signed: X-RCM-Signature: sha256=HMAC_SHA256(secret, body)."
}
```

**Delivered request** to your URL:

```
POST /hooks/rcm
Content-Type: application/json
X-RCM-Event: claim.denied
X-RCM-Signature: sha256=<hex hmac of the raw body>
X-RCM-Delivery: 5c2e1f8a-...
X-RCM-Attempt: 1

{
  "id": "5c2e1f8a-...",
  "event": "claim.denied",
  "timestamp": "2026-06-05T10:05:00.000Z",
  "data": { "claim": { "claimNumber": "CLM-2026-0026", "status": "DENIED", "...": "..." } }
}
```

Deliveries run **in the background** (they never block the API response) and **retry with bounded exponential backoff** — by default **3 attempts** (configurable via `RCM_WEBHOOK_MAX_ATTEMPTS`). Each attempt is logged server-side (`WebhookDelivery`) with status and response code, carries an `X-RCM-Attempt` header, and times out after 8 seconds. Inspect attempts via [the deliveries endpoint](#test--inspect-deliveries) below.

### Manage webhooks

`GET /api/v1/webhooks` — requires `read`. Lists subscriptions (secrets not returned).

`PATCH /api/v1/webhooks/{id}` — requires `write`. Enable/disable (`active`), change `events`, or update `description`.

```bash
# Disable a webhook
curl -X PATCH https://rcm.example.com/api/v1/webhooks/clx... \
  -H "X-API-Key: $RCM_KEY" -H "Content-Type: application/json" \
  -d '{ "active": false }'
```

`DELETE /api/v1/webhooks/{id}` — requires `write`. Removes the subscription.

```bash
curl -X DELETE https://rcm.example.com/api/v1/webhooks/clx... -H "X-API-Key: $RCM_KEY"
```

### Test & inspect deliveries

`POST /api/v1/webhooks/{id}/test` — requires `write`. Sends a signed **`ping`** event to the subscription so you can verify connectivity and signature handling end to end.

```bash
curl -X POST https://rcm.example.com/api/v1/webhooks/clx.../test -H "X-API-Key: $RCM_KEY"
```

`GET /api/v1/webhooks/{id}/deliveries` — requires `read`. Lists the most recent delivery attempts for the subscription, including `status`, `statusCode`, and the number of `attempts`.

```bash
curl https://rcm.example.com/api/v1/webhooks/clx.../deliveries -H "X-API-Key: $RCM_KEY"
```

```json
{
  "deliveries": [
    { "id": "5c2e1f8a-...", "event": "claim.denied", "status": "SUCCESS",
      "statusCode": 200, "attempts": 1, "at": "2026-06-05T10:05:00.000Z" },
    { "id": "9a1d4b22-...", "event": "ping", "status": "FAILED",
      "statusCode": 500, "attempts": 3, "at": "2026-06-05T10:04:10.000Z" }
  ]
}
```

### Verifying webhook signatures

Recompute the HMAC-SHA256 of the **raw request body** with your stored secret and compare it to `X-RCM-Signature`. Use a constant-time comparison.

```js
// Node.js (Express) — verify an inbound RCM webhook.
import crypto from 'node:crypto';
import express from 'express';

const app = express();
const SECRET = process.env.RCM_WEBHOOK_SECRET; // the whsec_... value

// IMPORTANT: verify against the RAW body, not the parsed object.
app.post('/hooks/rcm', express.raw({ type: '*/*' }), (req, res) => {
  const signature = req.header('X-RCM-Signature') || '';
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET)
    .update(req.body)               // req.body is a Buffer here
    .digest('hex');

  const ok =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!ok) return res.status(401).send('invalid signature');

  const envelope = JSON.parse(req.body.toString('utf8'));
  console.log(req.header('X-RCM-Event'), envelope.data);
  res.sendStatus(200); // return 2xx so the delivery is marked SUCCESS
});

app.listen(8080);
```

---

## End-to-End Walkthrough

A complete "submit a claim and process it" flow.

```bash
BASE="https://rcm.example.com"

# 0. (First-time) provision an API key while in bootstrap mode.
KEY=$(curl -s -X POST "$BASE/api/v1/keys" \
  -H "Content-Type: application/json" \
  -d '{ "name": "walkthrough", "scopes": ["read","write"] }' \
  | grep -o '"secret":"[^"]*"' | cut -d'"' -f4)

# 1. (Optional) eligibility pre-check before booking.
curl -s -X POST "$BASE/api/v1/eligibility" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "payerType": "NHIA", "totalAmount": 8500, "priorAuthNumber": "AUTH-45231" }'

# 2. Subscribe to lifecycle events.
curl -s -X POST "$BASE/api/v1/webhooks" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "url": "https://your-system.example.com/hooks/rcm", "events": ["*"] }'

# 3. Create the claim.
CLAIM=$(curl -s -X POST "$BASE/api/v1/claims" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "patientName": "Ahmed Mohamed Hassan", "nationalId": "29001011234567",
        "payerType": "NHIA", "serviceDate": "2026-05-01", "totalAmount": 8500,
        "priorAuthRequired": true, "priorAuthNumber": "AUTH-45231" }')
NUM=$(echo "$CLAIM" | grep -o '"claimNumber":"[^"]*"' | cut -d'"' -f4)

# 4. Run the pipeline automatically until a human gate or terminal state.
curl -s -X POST "$BASE/api/v1/claims/$NUM/process" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "mode": "auto" }'

# 5. Inspect the claim + its agent history.
curl -s "$BASE/api/v1/claims/$NUM" -H "X-API-Key: $KEY"
```

Along the way the platform persists each agent run (`ClaimEvent`), appends to the audit trail, and fires `claim.created`, `claim.status_changed`, `claim.submitted`, and `agent.run` webhook events to your subscriber.

---

## Error Codes

| Status | Meaning | Typical cause |
|-------:|---------|---------------|
| `200` | OK | Successful read/update/process. |
| `201` | Created | Claim(s), key, or webhook created. |
| `400` | Bad Request | Invalid JSON; non-`Claim` FHIR body; entire batch invalid. (Field-level validation failures return **422** instead — see below.) |
| `401` | Unauthorized | Auth enforced and no/invalid API key. Response carries `WWW-Authenticate: Bearer`. |
| `403` | Forbidden | Valid key, but it lacks the required scope. |
| `404` | Not Found | Claim or webhook does not exist. |
| `409` | Conflict | Invalid escalation state transition (internal `/api/escalations`). |
| `422` | Unprocessable Entity | Request body failed validation. Body is `{ error: "Validation failed", issues: [{ path, message }] }`. |
| `429` | Too Many Requests | Rate limit exceeded. Carries `Retry-After` plus `X-RateLimit-*` headers. |
| `500` | Server Error | Unexpected failure. |
| `503` | Service Unavailable | `/api/health` when the database is unreachable. |

Error bodies are JSON of the form `{ "error": "...", "message": "..." }` (FHIR endpoints return an `OperationOutcome` instead).

---

## OpenAPI & Swagger

- **OpenAPI 3.0 spec:** `GET /api/openapi.json`
- **Interactive Swagger UI:** `GET /docs`

```bash
curl https://rcm.example.com/api/openapi.json
# open https://rcm.example.com/docs in a browser
```

---

## Rate Limiting & Notes

- `/api/v1` enforces an application-level rate limit (default **240 requests / 60s** per API key or client IP; configurable via `RCM_RATE_LIMIT` / `RCM_RATE_WINDOW_MS`). Responses include `X-RateLimit-*` headers and an `X-Request-Id`; exceeding the limit returns **429** with `Retry-After`. See [Reliability & Limits](#reliability--limits). You may still layer your own gateway/reverse proxy (e.g. the bundled Caddy) for additional throttling.
- Webhook delivery retries with bounded exponential backoff (default 3 attempts, `RCM_WEBHOOK_MAX_ATTEMPTS`), runs in the background, and times out after 8 seconds per attempt; design your receiver to be idempotent (use `X-RCM-Delivery` for de-duplication, and `X-RCM-Attempt` to detect retries).
- For safe-to-retry claim creation, send an `Idempotency-Key` header (see [Idempotency keys](#idempotency-keys)).
- Key secrets and webhook signing secrets are shown **once** — store them immediately.
