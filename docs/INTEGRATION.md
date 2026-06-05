# Integration Guide

The complete guide to integrating with the **Veebase RCM Intelligence Platform** — authentication and bootstrap, the full `/api/v1` endpoint reference, batch ingestion, HL7 FHIR R4, webhooks (with signature verification), eligibility pre-checks, an end-to-end walkthrough, and error handling.

Throughout, the base URL placeholder is **`https://rcm.example.com`**. Replace it with your deployment (e.g. `http://localhost:3000` in development).

## Table of Contents

- [Authentication & Bootstrap](#authentication--bootstrap)
- [Scopes](#scopes)
- [Conventions](#conventions)
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

{
  "id": "5c2e1f8a-...",
  "event": "claim.denied",
  "timestamp": "2026-06-05T10:05:00.000Z",
  "data": { "claim": { "claimNumber": "CLM-2026-0026", "status": "DENIED", "...": "..." } }
}
```

Each delivery attempt is logged server-side (`WebhookDelivery`) with status and response code; the request times out after 8 seconds.

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
| `400` | Bad Request | Invalid JSON; missing `patientName`/numeric `totalAmount`; missing `url`/`name`; non-`Claim` FHIR body; entire batch invalid. |
| `401` | Unauthorized | Auth enforced and no/invalid API key. Response carries `WWW-Authenticate: Bearer`. |
| `403` | Forbidden | Valid key, but it lacks the required scope. |
| `404` | Not Found | Claim or webhook does not exist. |
| `409` | Conflict | Invalid escalation state transition (internal `/api/escalations`). |
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

- The platform does not currently impose application-level rate limits; deploy behind your own gateway/reverse proxy (e.g. the bundled Caddy) if you need throttling.
- Webhook delivery is fire-and-forget with an 8-second timeout per attempt; design your receiver to be idempotent (use `X-RCM-Delivery` for de-duplication).
- Key secrets and webhook signing secrets are shown **once** — store them immediately.
