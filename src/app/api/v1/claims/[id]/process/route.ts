import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { processOnce, processToGate } from '@/lib/server/claim-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/claims/:id/process — run the autonomous RCM agents on a claim.
 * Body: { mode?: 'step' | 'auto' }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === 'step' ? 'step' : 'auto';

  if (mode === 'step') {
    const outcome = await processOnce(id, auth.ctx.name);
    if (!outcome) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    return NextResponse.json({
      claim: outcome.claim,
      result: {
        agent: outcome.result.agentName,
        from: outcome.result.fromStatus,
        to: outcome.result.toStatus,
        confidence: outcome.result.confidence,
        hitlGate: outcome.result.hitlGate,
        rationale: outcome.result.rationale,
        output: outcome.result.output,
        escalation: outcome.escalationCreated,
      },
    });
  }

  const { steps, claim } = await processToGate(id, auth.ctx.name);
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  return NextResponse.json({
    claim,
    stepsRun: steps.length,
    steps: steps.map((s) => ({
      agent: s.result.agentName,
      from: s.result.fromStatus,
      to: s.result.toStatus,
      confidence: s.result.confidence,
      hitlGate: s.result.hitlGate,
      rationale: s.result.rationale,
      escalation: s.escalationCreated,
    })),
    stoppedAt: claim.status,
    requiresHuman: steps.length ? steps[steps.length - 1].result.hitlGate !== 'AUTO' : false,
  });
}
