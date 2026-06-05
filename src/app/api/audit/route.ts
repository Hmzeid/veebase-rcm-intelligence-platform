import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/server/audit';
import type { AuditEntry } from '@/lib/rcm-types';

export const dynamic = 'force-dynamic';

function serialize(a: {
  id: string; timestamp: Date; action: string; actor: string; actorRole: string;
  claimNumber: string | null; agentName: string | null; details: string;
  previousValue: string | null; newValue: string | null; riskLevel: string; tags: string;
}): AuditEntry {
  let tags: string[] = [];
  try { tags = JSON.parse(a.tags || '[]'); } catch { /* ignore */ }
  return {
    id: a.id,
    timestamp: a.timestamp.toISOString(),
    action: a.action as AuditEntry['action'],
    actor: a.actor,
    actorRole: a.actorRole,
    claimNumber: a.claimNumber ?? undefined,
    agentName: a.agentName ?? undefined,
    details: a.details,
    previousValue: a.previousValue ?? undefined,
    newValue: a.newValue ?? undefined,
    riskLevel: a.riskLevel as AuditEntry['riskLevel'],
    tags,
  };
}

/** GET /api/audit — compliance audit trail with optional filters. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const riskLevel = searchParams.get('riskLevel');
    const claimNumber = searchParams.get('claimNumber');
    const limit = parseInt(searchParams.get('limit') ?? '200', 10);

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (riskLevel) where.riskLevel = riskLevel;
    if (claimNumber) where.claimNumber = claimNumber;

    const rows = await db.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, take: limit });
    const entries = rows.map(serialize);
    return NextResponse.json({
      entries,
      summary: {
        total: entries.length,
        critical: entries.filter((e) => e.riskLevel === 'CRITICAL').length,
        high: entries.filter((e) => e.riskLevel === 'HIGH').length,
        hitlActions: entries.filter((e) => e.action.startsWith('HITL')).length,
      },
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit trail' }, { status: 500 });
  }
}

/** POST /api/audit — append an audit entry (used by UI actions). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await writeAudit({ ...body, source: body.source ?? 'ui' });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Audit POST error:', error);
    return NextResponse.json({ error: 'Failed to write audit entry' }, { status: 500 });
  }
}
