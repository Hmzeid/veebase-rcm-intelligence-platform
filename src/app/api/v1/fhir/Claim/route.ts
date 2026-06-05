import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { createClaim } from '@/lib/server/claim-service';
import type { PayerType } from '@/lib/rcm-types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/fhir/Claim — accept a FHIR R4 Claim resource and ingest it.
 * A pragmatic subset of the resource is mapped to the platform's claim model,
 * enabling EHR/HIS systems that speak FHIR to submit claims directly.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;

  const resource = await request.json().catch(() => null);
  if (!resource || resource.resourceType !== 'Claim') {
    return NextResponse.json(
      { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Expected a FHIR Claim resource (resourceType: "Claim").' }] },
      { status: 400 },
    );
  }

  const patientName: string = resource.patient?.display ?? 'Unknown Patient';
  const total: number = resource.total?.value ?? resource.total?.amount?.value ?? 0;
  const coverageDisplay: string = resource.insurance?.[0]?.coverage?.display ?? 'Private Insurer';
  const payerType = inferPayerType(coverageDisplay);
  const serviceDate: string | undefined = resource.billablePeriod?.start ?? resource.created;
  const preAuthRef: string | undefined = resource.insurance?.[0]?.preAuthRef?.[0];

  const claim = await createClaim(
    {
      patientName,
      nationalId: extractIdentifier(resource.patient),
      payerName: coverageDisplay,
      payerType,
      serviceDate,
      totalAmount: Number(total),
      priorAuthRequired: !!preAuthRef,
      priorAuthNumber: preAuthRef,
      source: 'fhir',
    },
    auth.ctx.name,
  );

  return NextResponse.json(toFhirClaim(claim), {
    status: 201,
    headers: { Location: `/api/v1/fhir/Claim/${claim.id}`, 'Content-Type': 'application/fhir+json' },
  });
}

function inferPayerType(name: string): PayerType {
  const n = name.toLowerCase();
  if (n.includes('nhia') || n.includes('national health')) return 'NHIA';
  if (n.includes('self') || n.includes('cash')) return 'SELF_PAY';
  return 'PRIVATE';
}

function extractIdentifier(patient: unknown): string {
  const p = patient as { identifier?: { value?: string } } | undefined;
  return p?.identifier?.value ?? '';
}

// Re-exported mapper used by the [id] route as well.
export function toFhirClaim(claim: {
  id: string; claimNumber: string; patientName: string; nationalId: string;
  payerName: string; totalAmount: number; status: string; serviceDate: string; priorAuthNumber?: string;
}) {
  return {
    resourceType: 'Claim',
    id: claim.id,
    identifier: [{ system: 'urn:veebase:claim', value: claim.claimNumber }],
    status: claim.status === 'PAID' || claim.status === 'CLOSED' ? 'active' : 'active',
    use: 'claim',
    patient: { display: claim.patientName, identifier: { value: claim.nationalId } },
    billablePeriod: { start: claim.serviceDate },
    insurance: [{
      sequence: 1, focal: true,
      coverage: { display: claim.payerName },
      ...(claim.priorAuthNumber ? { preAuthRef: [claim.priorAuthNumber] } : {}),
    }],
    total: { value: claim.totalAmount, currency: 'EGP' },
    extension: [{ url: 'urn:veebase:rcm-status', valueString: claim.status }],
  };
}
