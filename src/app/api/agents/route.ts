import { NextResponse } from 'next/server';
import { AGENTS } from '@/lib/rcm-data';
import type { AgentCategory, AgentStatusType } from '@/lib/rcm-types';

export async function GET() {
  try {
    // Compute agent summary statistics
    const activeCount = AGENTS.filter((a) => a.status === 'ACTIVE').length;
    const processingCount = AGENTS.filter((a) => a.status === 'PROCESSING').length;
    const idleCount = AGENTS.filter((a) => a.status === 'IDLE').length;
    const errorCount = AGENTS.filter((a) => a.status === 'ERROR').length;

    const totalClaimsProcessed = AGENTS.reduce((sum, a) => sum + a.claimsProcessed, 0);
    const totalActiveClaims = AGENTS.reduce((sum, a) => sum + a.activeClaims, 0);
    const totalErrors = AGENTS.reduce((sum, a) => sum + a.errorCount, 0);

    const avgProcessingMs =
      AGENTS.length > 0
        ? Math.round(AGENTS.reduce((sum, a) => sum + a.avgProcessingMs, 0) / AGENTS.length)
        : 0;

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

    // Status distribution
    const statusDistribution: Record<AgentStatusType, number> = {
      ACTIVE: activeCount,
      PROCESSING: processingCount,
      IDLE: idleCount,
      ERROR: errorCount,
    };

    return NextResponse.json({
      agents: AGENTS,
      summary: {
        totalAgents: AGENTS.length,
        activeCount,
        processingCount,
        idleCount,
        errorCount,
        totalClaimsProcessed,
        totalActiveClaims,
        totalErrors,
        avgProcessingMs,
        statusDistribution,
      },
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
