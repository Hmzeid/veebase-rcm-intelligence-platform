import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/server/audit';
import { emitEvent } from '@/lib/server/webhooks';
import type { EscalationRecord, EscalationStatus } from '@/lib/rcm-types';

export const dynamic = 'force-dynamic';

function serialize(e: {
  id: string; claimId: string; claimNumber: string; level: number; reason: string;
  agentName: string; status: string; tags: string; assignedTo: string | null;
  resolvedAt: Date | null; createdAt: Date;
}): EscalationRecord {
  let tags: string[] = [];
  try { tags = JSON.parse(e.tags || '[]'); } catch { /* ignore */ }
  return {
    id: e.id, claimId: e.claimId, claimNumber: e.claimNumber, level: e.level,
    reason: e.reason, agentName: e.agentName, status: e.status as EscalationStatus,
    tags, assignedTo: e.assignedTo ?? undefined,
    resolvedAt: e.resolvedAt?.toISOString() ?? undefined,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as EscalationStatus | null;
    const level = searchParams.get('level') ? parseInt(searchParams.get('level')!, 10) : null;
    const tag = searchParams.get('tag');
    const agentName = searchParams.get('agentName');

    const rows = await db.escalation.findMany({ orderBy: { createdAt: 'desc' } });
    let filtered = rows.map(serialize);

    if (status) filtered = filtered.filter((e) => e.status === status);
    if (level !== null) filtered = filtered.filter((e) => e.level === level);
    if (tag) filtered = filtered.filter((e) => e.tags.includes(tag));
    if (agentName) filtered = filtered.filter((e) => e.agentName === agentName);

    const levelDistribution: Record<number, number> = {};
    for (const e of filtered) levelDistribution[e.level] = (levelDistribution[e.level] || 0) + 1;

    return NextResponse.json({
      escalations: filtered,
      summary: {
        total: filtered.length,
        pendingCount: filtered.filter((e) => e.status === 'PENDING').length,
        acknowledgedCount: filtered.filter((e) => e.status === 'ACKNOWLEDGED').length,
        resolvedCount: filtered.filter((e) => e.status === 'RESOLVED').length,
        escalatedCount: filtered.filter((e) => e.status === 'ESCALATED').length,
        criticalCount: filtered.filter((e) => e.level >= 4 && (e.status === 'PENDING' || e.status === 'ESCALATED')).length,
        levelDistribution,
      },
    });
  } catch (error) {
    console.error('Escalations API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve escalation data' }, { status: 500 });
  }
}

interface PatchBody {
  id: string;
  action: 'acknowledge' | 'resolve';
  assignedTo?: string;
  resolution?: string;
}

export async function PATCH(request: NextRequest) {
  try {
    const body: PatchBody = await request.json();
    const { id, action, assignedTo, resolution } = body;
    if (!id || !action) return NextResponse.json({ error: 'Escalation id and action are required' }, { status: 400 });
    if (action !== 'acknowledge' && action !== 'resolve') {
      return NextResponse.json({ error: 'Action must be "acknowledge" or "resolve"' }, { status: 400 });
    }

    const existing = await db.escalation.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: `Escalation "${id}" not found` }, { status: 404 });

    if (action === 'acknowledge' && existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING escalations can be acknowledged' }, { status: 409 });
    }
    if (action === 'resolve' && existing.status !== 'ACKNOWLEDGED' && existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING or ACKNOWLEDGED escalations can be resolved' }, { status: 409 });
    }

    const updated = await db.escalation.update({
      where: { id },
      data: action === 'acknowledge'
        ? { status: 'ACKNOWLEDGED', assignedTo: assignedTo || 'Current User' }
        : { status: 'RESOLVED', resolvedAt: new Date(), assignedTo: assignedTo || existing.assignedTo || 'Current User' },
    });

    const esc = serialize(updated);
    await writeAudit({
      action: action === 'acknowledge' ? 'ESCALATE' : 'RESOLVE',
      actor: assignedTo || 'Current User',
      actorRole: 'Staff',
      claimId: esc.claimId,
      claimNumber: esc.claimNumber,
      agentName: esc.agentName,
      details: `Escalation ${action === 'acknowledge' ? 'acknowledged' : 'resolved'} for ${esc.claimNumber}. Reason: ${esc.reason}${resolution ? ` — ${resolution}` : ''}`,
      previousValue: existing.status,
      newValue: esc.status,
      riskLevel: esc.level >= 4 ? 'HIGH' : 'MEDIUM',
      tags: ['ESCALATION', action.toUpperCase()],
      source: 'ui',
    });
    if (action === 'resolve') await emitEvent('escalation.resolved', { escalation: esc });

    return NextResponse.json({ escalation: esc, action, message: `Escalation ${id} ${action === 'acknowledge' ? 'acknowledged' : 'resolved'}.` });
  } catch (error) {
    console.error('Escalation PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update escalation' }, { status: 500 });
  }
}
