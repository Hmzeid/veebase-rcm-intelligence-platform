import { NextRequest, NextResponse } from 'next/server';
import { listClaims, createClaim, type CreateClaimInput } from '@/lib/server/claim-service';

export const dynamic = 'force-dynamic';

/** GET /api/claims — internal/UI claim list with filtering, pagination & summary. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await listClaims({
      status: searchParams.get('status'),
      payerType: searchParams.get('payerType'),
      payerId: searchParams.get('payerId'),
      minAmount: searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined,
      maxAmount: searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined,
      tag: searchParams.get('tag'),
      search: searchParams.get('search') ?? undefined,
      page: parseInt(searchParams.get('page') ?? '1', 10),
      limit: parseInt(searchParams.get('limit') ?? '50', 10),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Claims API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve claims data' }, { status: 500 });
  }
}

/** POST /api/claims — create a claim through the engine-scored service layer. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateClaimInput;
    if (!body?.patientName || typeof body.totalAmount !== 'number') {
      return NextResponse.json({ error: 'patientName and numeric totalAmount are required' }, { status: 400 });
    }
    const claim = await createClaim({ ...body, source: body.source ?? 'ui' }, 'UI User');
    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    console.error('Create claim error:', error);
    return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
  }
}
