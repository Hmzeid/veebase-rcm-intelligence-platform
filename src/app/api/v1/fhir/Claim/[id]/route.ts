import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { getClaim } from '@/lib/server/claim-service';
import { toFhirClaim } from '../route';

export const dynamic = 'force-dynamic';

/** GET /api/v1/fhir/Claim/:id — return a claim as a FHIR R4 Claim resource. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) {
    return NextResponse.json(
      { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Claim ${id} not found.` }] },
      { status: 404 },
    );
  }
  return NextResponse.json(toFhirClaim(claim), { headers: { 'Content-Type': 'application/fhir+json' } });
}
