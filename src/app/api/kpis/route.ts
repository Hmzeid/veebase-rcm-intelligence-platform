import { NextRequest, NextResponse } from 'next/server';
import { KPIS, DENIAL_TREND_DATA, REVENUE_BY_PAYER, DENIAL_BY_REASON } from '@/lib/rcm-data';
import type { KPIStatus, KPITrend } from '@/lib/rcm-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') as string | null;
    const status = searchParams.get('status') as KPIStatus | null;
    const trend = searchParams.get('trend') as KPITrend | null;

    let filtered = [...KPIS];

    // Apply filters
    if (category) {
      filtered = filtered.filter((k) => k.category === category);
    }
    if (status) {
      filtered = filtered.filter((k) => k.status === status);
    }
    if (trend) {
      filtered = filtered.filter((k) => k.trend === trend);
    }

    // Compute summary
    const onTarget = filtered.filter((k) => k.status === 'ON_TARGET').length;
    const warning = filtered.filter((k) => k.status === 'WARNING').length;
    const offTarget = filtered.filter((k) => k.status === 'OFF_TARGET').length;

    const improving = filtered.filter((k) => k.trend === 'IMPROVING').length;
    const stable = filtered.filter((k) => k.trend === 'STABLE').length;
    const degrading = filtered.filter((k) => k.trend === 'DEGRADING').length;

    // Group by category
    const byCategory: Record<string, typeof filtered> = {};
    for (const kpi of filtered) {
      if (!byCategory[kpi.category]) {
        byCategory[kpi.category] = [];
      }
      byCategory[kpi.category].push(kpi);
    }

    return NextResponse.json({
      kpis: filtered,
      trendData: DENIAL_TREND_DATA,
      revenueByPayer: REVENUE_BY_PAYER,
      denialByReason: DENIAL_BY_REASON,
      summary: {
        total: filtered.length,
        onTarget,
        warning,
        offTarget,
        improving,
        stable,
        degrading,
      },
      byCategory,
    });
  } catch (error) {
    console.error('KPIs API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve KPI data' },
      { status: 500 }
    );
  }
}
