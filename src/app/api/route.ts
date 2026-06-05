import { NextResponse } from 'next/server';

/** GET /api — API index: points integrators at the docs and key endpoints. */
export async function GET() {
  return NextResponse.json({
    service: 'Veebase RCM Intelligence Platform',
    version: '1.0.0',
    documentation: '/docs',
    openapi: '/api/openapi.json',
    health: '/api/health',
    metrics: '/api/metrics',
    integrationApi: {
      base: '/api/v1',
      auth: 'X-API-Key header (or Authorization: Bearer)',
      endpoints: [
        'GET/POST /api/v1/claims',
        'GET/PATCH /api/v1/claims/{id}',
        'POST /api/v1/claims/{id}/process',
        'POST /api/v1/eligibility',
        'POST /api/v1/fhir/Claim',
        'GET /api/v1/fhir/Claim/{id}',
        'GET/POST /api/v1/webhooks',
        'GET/POST /api/v1/keys',
      ],
    },
  });
}
