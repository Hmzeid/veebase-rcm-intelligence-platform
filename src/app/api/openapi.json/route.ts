import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Veebase RCM Intelligence Platform API',
    version: '1.0.0',
    description:
      'Inbound + outbound integration API for the Veebase Agentic RCM platform. ' +
      'Submit claims (native JSON or FHIR R4), run the autonomous agent pipeline, ' +
      'check eligibility, and subscribe to lifecycle events via signed webhooks.',
  },
  servers: [{ url: '/', description: 'This deployment' }],
  security: [{ ApiKeyAuth: [] }],
  tags: [
    { name: 'Claims', description: 'Create, read, update and process claims' },
    { name: 'Eligibility', description: 'Real-time eligibility & risk pre-check' },
    { name: 'FHIR', description: 'HL7 FHIR R4 interoperability' },
    { name: 'Webhooks', description: 'Outbound event subscriptions' },
    { name: 'Keys', description: 'API key management' },
    { name: 'System', description: 'Health and operations' },
  ],
  paths: {
    '/api/health': {
      get: { tags: ['System'], summary: 'Health & readiness probe', security: [], responses: { '200': { description: 'Service healthy' } } },
    },
    '/api/v1/claims': {
      get: {
        tags: ['Claims'], summary: 'List claims',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'payerType', in: 'query', schema: { type: 'string', enum: ['NHIA', 'PRIVATE', 'SELF_PAY'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated claims with summary' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Claims'], summary: 'Create a claim or batch of claims',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { oneOf: [{ $ref: '#/components/schemas/ClaimInput' }, { type: 'object', properties: { claims: { type: 'array', items: { $ref: '#/components/schemas/ClaimInput' } } } }] } } },
        },
        responses: { '201': { description: 'Claim(s) created' }, '400': { description: 'Validation error' } },
      },
    },
    '/api/v1/claims/{id}': {
      get: { tags: ['Claims'], summary: 'Get a claim with processing history', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Claim' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Claims'], summary: 'Update mutable claim fields', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
    },
    '/api/v1/claims/{id}/process': {
      post: {
        tags: ['Claims'], summary: 'Run the autonomous RCM agents on a claim',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { mode: { type: 'string', enum: ['step', 'auto'], default: 'auto' } } } } } },
        responses: { '200': { description: 'Processing result; stops at any human gate' } },
      },
    },
    '/api/v1/eligibility': {
      post: {
        tags: ['Eligibility'], summary: 'Real-time eligibility & denial-risk pre-check',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { payerType: { type: 'string' }, totalAmount: { type: 'number' }, priorAuthNumber: { type: 'string' } }, required: ['payerType', 'totalAmount'] } } } },
        responses: { '200': { description: 'Eligibility result' } },
      },
    },
    '/api/v1/fhir/Claim': {
      post: { tags: ['FHIR'], summary: 'Ingest a FHIR R4 Claim resource', requestBody: { required: true, content: { 'application/fhir+json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'FHIR Claim created' } } },
    },
    '/api/v1/fhir/Claim/{id}': {
      get: { tags: ['FHIR'], summary: 'Read a claim as FHIR R4', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'FHIR Claim' } } },
    },
    '/api/v1/webhooks': {
      get: { tags: ['Webhooks'], summary: 'List webhook subscriptions', responses: { '200': { description: 'Webhooks' } } },
      post: {
        tags: ['Webhooks'], summary: 'Register an outbound webhook',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' }, events: { type: 'array', items: { type: 'string' } }, description: { type: 'string' } }, required: ['url'] } } } },
        responses: { '201': { description: 'Created — returns signing secret once' } },
      },
    },
    '/api/v1/webhooks/{id}': {
      patch: { tags: ['Webhooks'], summary: 'Enable/disable or update a webhook', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Webhooks'], summary: 'Delete a webhook', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/v1/keys': {
      get: { tags: ['Keys'], summary: 'List API keys', responses: { '200': { description: 'Keys (no secrets)' } } },
      post: { tags: ['Keys'], summary: 'Provision a new API key', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, scopes: { type: 'array', items: { type: 'string' } } }, required: ['name'] } } } }, responses: { '201': { description: 'Created — returns secret once' } } },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
    schemas: {
      ClaimInput: {
        type: 'object',
        required: ['patientName', 'totalAmount'],
        properties: {
          patientName: { type: 'string' },
          nationalId: { type: 'string' },
          payerType: { type: 'string', enum: ['NHIA', 'PRIVATE', 'SELF_PAY'] },
          payerName: { type: 'string' },
          serviceDate: { type: 'string', format: 'date-time' },
          totalAmount: { type: 'number' },
          priorAuthRequired: { type: 'boolean' },
          priorAuthNumber: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  'x-events': {
    description: 'Events delivered to registered webhooks. Signed with X-RCM-Signature: sha256=HMAC_SHA256(secret, rawBody).',
    events: [
      'claim.created', 'claim.updated', 'claim.status_changed', 'claim.submitted',
      'claim.denied', 'claim.paid', 'claim.written_off', 'escalation.created', 'agent.run',
    ],
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
