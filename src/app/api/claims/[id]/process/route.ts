import { NextRequest, NextResponse } from 'next/server';
import { processOnce, processToGate } from '@/lib/server/claim-service';

export const dynamic = 'force-dynamic';

/**
 * Run the RCM engine on a claim (internal/UI endpoint).
 * Body: { mode?: 'step' | 'auto', actor?: string }
 *  - step: advance exactly one pipeline stage
 *  - auto: advance until a human gate, terminal status, or safety cap
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'auto' ? 'auto' : 'step';
    const actor = body.actor ?? 'Operator';

    if (mode === 'auto') {
      const { steps, claim } = await processToGate(id, actor);
      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      return NextResponse.json({
        claim,
        steps: steps.map((s) => ({
          agent: s.result.agentName,
          from: s.result.fromStatus,
          to: s.result.toStatus,
          confidence: s.result.confidence,
          hitlGate: s.result.hitlGate,
          rationale: s.result.rationale,
          escalation: s.escalationCreated,
        })),
        stepsRun: steps.length,
      });
    }

    const outcome = await processOnce(id, actor);
    if (!outcome) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    return NextResponse.json({
      claim: outcome.claim,
      result: {
        agent: outcome.result.agentName,
        displayName: outcome.result.displayName,
        from: outcome.result.fromStatus,
        to: outcome.result.toStatus,
        confidence: outcome.result.confidence,
        hitlGate: outcome.result.hitlGate,
        rationale: outcome.result.rationale,
        recommendedAction: outcome.result.recommendedAction,
        output: outcome.result.output,
        escalation: outcome.escalationCreated,
      },
    });
  } catch (error) {
    console.error('Process claim error:', error);
    return NextResponse.json({ error: 'Failed to process claim' }, { status: 500 });
  }
}
