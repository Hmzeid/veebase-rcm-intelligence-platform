import { NextRequest, NextResponse } from 'next/server';
import { listProviders, setActiveProviderId, type ProviderId } from '@/lib/ai';
import { ALL_PROVIDER_IDS } from '@/lib/ai/config';
import { writeAudit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

/** GET /api/ai — list providers, the active one, and the failover chain. */
export async function GET() {
  const data = await listProviders();
  return NextResponse.json(data);
}

/** POST /api/ai — switch the active AI provider. Body: { provider }. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const provider = body.provider as ProviderId;
  if (!ALL_PROVIDER_IDS.includes(provider)) {
    return NextResponse.json({ error: `Unknown provider. Use one of: ${ALL_PROVIDER_IDS.join(', ')}` }, { status: 400 });
  }
  await setActiveProviderId(provider);
  await writeAudit({
    action: 'AGENT_OVERRIDE',
    actor: 'Operator',
    actorRole: 'Admin',
    details: `Active AI provider switched to "${provider}".`,
    newValue: provider,
    riskLevel: 'MEDIUM',
    tags: ['AI_PROVIDER'],
    source: 'ui',
  });
  return NextResponse.json(await listProviders());
}
