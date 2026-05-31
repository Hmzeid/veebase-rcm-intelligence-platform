import { NextResponse } from 'next/server';
import {
  AGENTS,
  CLAIMS,
  ESCALATIONS,
  KPIS,
  DASHBOARD_SUMMARY,
  CLAIMS_BY_STAGE,
  DAILY_CLAIMS_VOLUME,
  AGENT_ACTIVITY_DATA,
  PAYER_MIX,
} from '@/lib/rcm-data';

export async function GET() {
  try {
    // Live computed metrics from data
    const activeAgents = AGENTS.filter((a) => a.status === 'ACTIVE' || a.status === 'PROCESSING').length;
    const pendingEscalations = ESCALATIONS.filter(
      (e) => e.status === 'PENDING' || e.status === 'ESCALATED'
    ).length;
    const criticalEscalations = ESCALATIONS.filter(
      (e) => e.level >= 4 && (e.status === 'PENDING' || e.status === 'ESCALATED')
    ).length;

    const claimsInPipeline = CLAIMS.filter(
      (c) => !['PAID', 'CLOSED', 'WRITTEN_OFF'].includes(c.status)
    ).length;

    const deniedClaims = CLAIMS.filter((c) => c.status === 'DENIED').length;
    const paidClaims = CLAIMS.filter((c) => c.status === 'PAID').length;

    const totalBilled = CLAIMS.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalPaid = CLAIMS.reduce((sum, c) => sum + c.paidAmount, 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0;

    const avgReadiness =
      CLAIMS.length > 0
        ? Math.round(CLAIMS.reduce((sum, c) => sum + c.readinessScore, 0) / CLAIMS.length)
        : 0;

    const avgDenialRisk =
      CLAIMS.length > 0
        ? Math.round(CLAIMS.reduce((sum, c) => sum + c.denialRiskScore, 0) / CLAIMS.length)
        : 0;

    // KPI status counts
    const kpiOnTarget = KPIS.filter((k) => k.status === 'ON_TARGET').length;
    const kpiWarning = KPIS.filter((k) => k.status === 'WARNING').length;
    const kpiOffTarget = KPIS.filter((k) => k.status === 'OFF_TARGET').length;

    // Recent activity (last 5 claims updated)
    const recentClaims = [...CLAIMS]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        status: c.status,
        updatedAt: c.updatedAt,
        currentAgent: c.currentAgent,
      }));

    // Top at-risk claims (high denial risk)
    const atRiskClaims = [...CLAIMS]
      .filter((c) => c.denialRiskScore >= 70 && !['PAID', 'CLOSED', 'WRITTEN_OFF'].includes(c.status))
      .sort((a, b) => b.denialRiskScore - a.denialRiskScore)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        denialRiskScore: c.denialRiskScore,
        status: c.status,
        totalAmount: c.totalAmount,
      }));

    return NextResponse.json({
      summary: {
        ...DASHBOARD_SUMMARY,
        activeAgents,
        pendingEscalations,
        criticalEscalations,
        claimsInPipeline,
        deniedClaims,
        paidClaims,
        collectionRate,
        avgReadinessScore: avgReadiness,
        avgDenialRiskScore: avgDenialRisk,
      },
      kpiOverview: {
        onTarget: kpiOnTarget,
        warning: kpiWarning,
        offTarget: kpiOffTarget,
      },
      pipeline: {
        claimsByStage: CLAIMS_BY_STAGE,
        dailyVolume: DAILY_CLAIMS_VOLUME,
      },
      agentActivity: AGENT_ACTIVITY_DATA,
      payerMix: PAYER_MIX,
      recentActivity: recentClaims,
      atRiskClaims,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve dashboard data' },
      { status: 500 }
    );
  }
}
