import { NextRequest, NextResponse } from 'next/server';
import { ESCALATIONS } from '@/lib/rcm-data';
import type { EscalationStatus } from '@/lib/rcm-types';

// In-memory store for mutation tracking (resets on server restart)
// In production this would use the database
const escalationOverrides = new Map<string, Partial<EscalationRecord & { resolvedAt?: string }>>();

function getEscalations() {
  return ESCALATIONS.map((esc) => {
    const override = escalationOverrides.get(esc.id);
    return override ? { ...esc, ...override } : esc;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as EscalationStatus | null;
    const level = searchParams.get('level') ? parseInt(searchParams.get('level')!, 10) : null;
    const tag = searchParams.get('tag') as string | null;
    const agentName = searchParams.get('agentName') as string | null;

    let filtered = getEscalations();

    // Apply filters
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }
    if (level !== null) {
      filtered = filtered.filter((e) => e.level === level);
    }
    if (tag) {
      filtered = filtered.filter((e) => e.tags.includes(tag));
    }
    if (agentName) {
      filtered = filtered.filter((e) => e.agentName === agentName);
    }

    // Compute summary
    const pendingCount = filtered.filter((e) => e.status === 'PENDING').length;
    const acknowledgedCount = filtered.filter((e) => e.status === 'ACKNOWLEDGED').length;
    const resolvedCount = filtered.filter((e) => e.status === 'RESOLVED').length;
    const escalatedCount = filtered.filter((e) => e.status === 'ESCALATED').length;

    const levelDistribution: Record<number, number> = {};
    for (const e of filtered) {
      levelDistribution[e.level] = (levelDistribution[e.level] || 0) + 1;
    }

    // Critical escalations (level 4+ that are pending)
    const criticalCount = filtered.filter(
      (e) => e.level >= 4 && (e.status === 'PENDING' || e.status === 'ESCALATED')
    ).length;

    return NextResponse.json({
      escalations: filtered,
      summary: {
        total: filtered.length,
        pendingCount,
        acknowledgedCount,
        resolvedCount,
        escalatedCount,
        criticalCount,
        levelDistribution,
      },
    });
  } catch (error) {
    console.error('Escalations API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve escalation data' },
      { status: 500 }
    );
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

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Escalation id and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'acknowledge' && action !== 'resolve') {
      return NextResponse.json(
        { error: 'Action must be either "acknowledge" or "resolve"' },
        { status: 400 }
      );
    }

    // Find the escalation
    const escalation = ESCALATIONS.find((e) => e.id === id);
    if (!escalation) {
      return NextResponse.json(
        { error: `Escalation with id "${id}" not found` },
        { status: 404 }
      );
    }

    // Check current state transitions
    const currentEsc = getEscalations().find((e) => e.id === id);
    if (currentEsc) {
      if (action === 'acknowledge' && currentEsc.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Only PENDING escalations can be acknowledged' },
          { status: 409 }
        );
      }
      if (action === 'resolve' && currentEsc.status !== 'ACKNOWLEDGED' && currentEsc.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Only PENDING or ACKNOWLEDGED escalations can be resolved' },
          { status: 409 }
        );
      }
    }

    // Apply the state change
    if (action === 'acknowledge') {
      escalationOverrides.set(id, {
        ...escalationOverrides.get(id),
        status: 'ACKNOWLEDGED',
        assignedTo: assignedTo || 'Current User',
      });
    } else if (action === 'resolve') {
      escalationOverrides.set(id, {
        ...escalationOverrides.get(id),
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        assignedTo: assignedTo || escalationOverrides.get(id)?.assignedTo || 'Current User',
      });
    }

    const updated = getEscalations().find((e) => e.id === id);

    return NextResponse.json({
      escalation: updated,
      action,
      message: `Escalation ${id} successfully ${action === 'acknowledge' ? 'acknowledged' : 'resolved'}${resolution ? `: ${resolution}` : ''}`,
    });
  } catch (error) {
    console.error('Escalation PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update escalation' },
      { status: 500 }
    );
  }
}
