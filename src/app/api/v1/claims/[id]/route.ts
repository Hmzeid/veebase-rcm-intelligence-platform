import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { getClaim, updateClaim } from '@/lib/server/claim-service';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/claims/:id — fetch a single claim (by id or claim number) with its processing history. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  const events = await db.claimEvent
    .findMany({ where: { claimId: claim.id }, orderBy: { createdAt: 'asc' } })
    .catch(() => []);

  return NextResponse.json({
    claim,
    history: events.map((e) => ({
      agent: e.agentName,
      from: e.fromStatus,
      to: e.toStatus,
      confidence: e.confidence,
      hitlGate: e.hitlGate,
      rationale: e.rationale,
      at: e.createdAt.toISOString(),
    })),
  });
}

/** PATCH /api/v1/claims/:id — update mutable claim fields. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const claim = await updateClaim(id, body, auth.ctx.name);
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  return NextResponse.json({ claim });
}
