import { NextResponse } from 'next/server';
import { AGENTS } from '@/lib/rcm-data';
import { db } from '@/lib/db';
import type { AgentCategory, AgentStatusType, AgentRecord } from '@/lib/rcm-types';

function computeSummary(agents: AgentRecord[]) {
  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;
  const processingCount = agents.filter((a) => a.status === 'PROCESSING').length;
  const idleCount = agents.filter((a) => a.status === 'IDLE').length;
  const errorCount = agents.filter((a) => a.status === 'ERROR').length;

  const totalClaimsProcessed = agents.reduce((sum, a) => sum + a.claimsProcessed, 0);
  const totalActiveClaims = agents.reduce((sum, a) => sum + a.activeClaims, 0);
  const totalErrors = agents.reduce((sum, a) => sum + a.errorCount, 0);

  const avgProcessingMs =
    agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.avgProcessingMs, 0) / agents.length)
      : 0;

  const statusDistribution: Record<AgentStatusType, number> = {
    ACTIVE: activeCount,
    PROCESSING: processingCount,
    IDLE: idleCount,
    ERROR: errorCount,
  };

  return {
    totalAgents: agents.length,
    activeCount,
    processingCount,
    idleCount,
    errorCount,
    totalClaimsProcessed,
    totalActiveClaims,
    totalErrors,
    avgProcessingMs,
    statusDistribution,
  };
}

export async function GET() {
  try {
    // Try reading from the database first
    try {
      const dbAgents = await db.agentStatus.findMany({ orderBy: { sequence: 'asc' } });

      if (dbAgents.length > 0) {
        // Transform DB records to match AgentRecord type
        const agents: AgentRecord[] = dbAgents.map((a) => ({
          id: a.id,
          agentName: a.agentName,
          displayName: a.displayName,
          description: a.description,
          icon: a.icon,
          status: a.status as AgentStatusType,
          lastActivity: a.lastActivity?.toISOString() ?? undefined,
          claimsProcessed: a.claimsProcessed,
          activeClaims: a.activeClaims,
          errorCount: a.errorCount,
          avgProcessingMs: a.avgProcessingMs,
          category: a.category as AgentCategory,
          sequence: a.sequence,
        }));

        // Group by category
        const byCategory: Record<AgentCategory, AgentRecord[]> = {
          LINEAR: [],
          SENTINEL: [],
          KNOWLEDGE: [],
          ANALYTICS: [],
        };
        for (const agent of agents) {
          byCategory[agent.category].push(agent);
        }

        return NextResponse.json({
          agents,
          summary: computeSummary(agents),
          categories: {
            linear: byCategory.LINEAR,
            sentinel: byCategory.SENTINEL,
            knowledge: byCategory.KNOWLEDGE,
            analytics: byCategory.ANALYTICS,
          },
        });
      }
    } catch (e) {
      // Fall through to mock data
      console.error('DB read failed, falling back to mock data:', e);
    }

    // Fallback: use mock data
    const summary = computeSummary(AGENTS);

    // Group by category
    const byCategory: Record<AgentCategory, typeof AGENTS> = {
      LINEAR: [],
      SENTINEL: [],
      KNOWLEDGE: [],
      ANALYTICS: [],
    };
    for (const agent of AGENTS) {
      byCategory[agent.category].push(agent);
    }

    return NextResponse.json({
      agents: AGENTS,
      summary,
      categories: {
        linear: byCategory.LINEAR,
        sentinel: byCategory.SENTINEL,
        knowledge: byCategory.KNOWLEDGE,
        analytics: byCategory.ANALYTICS,
      },
    });
  } catch (error) {
    console.error('Agents API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve agent data' },
      { status: 500 }
    );
  }
}
