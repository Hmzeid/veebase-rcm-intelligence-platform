import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { listClaims, createClaim, type CreateClaimInput } from '@/lib/server/claim-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/claims — list claims with filtering, pagination, and summary. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const result = await listClaims({
    status: searchParams.get('status'),
    payerType: searchParams.get('payerType'),
    payerId: searchParams.get('payerId'),
    minAmount: searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : undefined,
    maxAmount: searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : undefined,
    tag: searchParams.get('tag'),
    search: searchParams.get('search') ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
  });
  return NextResponse.json(result);
}

/**
 * POST /api/v1/claims — create one claim or a batch.
 * Body: a single claim object OR { claims: [...] } for batch ingestion.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const batch: CreateClaimInput[] | null = Array.isArray(body)
    ? (body as CreateClaimInput[])
    : body && typeof body === 'object' && Array.isArray((body as { claims?: unknown }).claims)
      ? ((body as { claims: CreateClaimInput[] }).claims)
      : null;

  if (batch) {
    const created: Awaited<ReturnType<typeof createClaim>>[] = [];
    const errors: { index: number; error: string }[] = [];
    for (const [i, item] of batch.entries()) {
      if (!item?.patientName || typeof item.totalAmount !== 'number') {
        errors.push({ index: i, error: 'patientName and numeric totalAmount are required' });
        continue;
      }
      try {
        created.push(await createClaim({ ...item, source: 'api-batch' }, auth.ctx.name));
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : 'create failed' });
      }
    }
    return NextResponse.json({ created, createdCount: created.length, errors }, { status: errors.length && !created.length ? 400 : 201 });
  }

  const single = body as CreateClaimInput;
  if (!single?.patientName || typeof single.totalAmount !== 'number') {
    return NextResponse.json({ error: 'patientName and numeric totalAmount are required' }, { status: 400 });
  }
  const claim = await createClaim({ ...single, source: 'api' }, auth.ctx.name);
  return NextResponse.json({ claim }, { status: 201 });
}
