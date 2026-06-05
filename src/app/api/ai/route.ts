import { NextRequest, NextResponse } from 'next/server';
import { listProviders, setActiveProviderId, type ProviderId } from '@/lib/ai';
import { ALL_PROVIDER_IDS } from '@/lib/ai/config';
import { writeAudit } from '@/lib/server/audit';
import { requireSession } from '@/lib/server/require-session';

export const dynamic = 'force-dynamic';

/** GET /api/ai — list providers, the active one, and the failover chain. */
export async function GET() {
  const data = await listProviders();
  return NextResponse.json(data);
}

/** POST /api/ai — switch the active AI provider (requires ai.manage). Body: { provider }. */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request, 'ai.manage');
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const provider = body.provider as ProviderId;
  if (!ALL_PROVIDER_IDS.includes(provider)) {
    return NextResponse.json({ error: `Unknown provider. Use one of: ${ALL_PROVIDER_IDS.join(', ')}` }, { status: 400 });
  }
  await setActiveProviderId(provider);
  await writeAudit({
    action: 'AGENT_OVERRIDE',
    actor: auth.ctx.user,
    actorRole: auth.ctx.role,
    details: `Active AI provider switched to "${provider}".`,
    newValue: provider,
    riskLevel: 'MEDIUM',
    tags: ['AI_PROVIDER'],
    source: 'ui',
  });
  return NextResponse.json(await listProviders());
}
