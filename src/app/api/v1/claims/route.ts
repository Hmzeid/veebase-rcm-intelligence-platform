import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { listClaims, createClaim } from '@/lib/server/claim-service';
import { parseBody, ClaimCreateSchema, normaliseClaimCreate } from '@/lib/validation';
import { withIdempotency } from '@/lib/server/idempotency';

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
 * Body: a single claim object, a raw array, or { claims: [...] }.
 * Supports an `Idempotency-Key` header for safe retries on single creates.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;

  const parsed = await parseBody(request, ClaimCreateSchema);
  if (!parsed.ok) return parsed.response;

  const { items, isBatch } = normaliseClaimCreate(parsed.data);

  if (!isBatch) {
    const claim = await withIdempotency(request, auth.ctx.keyId, () =>
      createClaim({ ...items[0], source: 'api' }, auth.ctx.name),
    );
    return NextResponse.json({ claim }, { status: 201 });
  }

  const created: Awaited<ReturnType<typeof createClaim>>[] = [];
  const errors: { index: number; error: string }[] = [];
  for (const [i, item] of items.entries()) {
    try {
      created.push(await createClaim({ ...item, source: 'api-batch' }, auth.ctx.name));
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : 'create failed' });
    }
  }
  return NextResponse.json(
    { created, createdCount: created.length, errors },
    { status: errors.length && !created.length ? 400 : 201 },
  );
}
