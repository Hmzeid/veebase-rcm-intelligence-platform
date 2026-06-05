import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/metrics — operational metrics for dashboards/scrapers.
 * `?format=prometheus` returns Prometheus text exposition; default is JSON.
 */
export async function GET(request: NextRequest) {
  const claims = await db.claim.findMany({ select: { status: true, paidAmount: true, totalAmount: true } }).catch(() => []);
  const statusCounts: Record<string, number> = {};
  let billed = 0;
  let paid = 0;
  for (const c of claims) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    billed += c.totalAmount;
    paid += c.paidAmount;
  }

  const [pendingEsc, deliveries, failedDeliveries, users] = await Promise.all([
    db.escalation.count({ where: { status: 'PENDING' } }).catch(() => 0),
    db.webhookDelivery.count().catch(() => 0),
    db.webhookDelivery.count({ where: { status: 'FAILED' } }).catch(() => 0),
    db.user.count().catch(() => 0),
  ]);

  const metrics = {
    claims_total: claims.length,
    claims_by_status: statusCounts,
    claims_billed_egp: Math.round(billed),
    claims_paid_egp: Math.round(paid),
    collection_rate_pct: billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0,
    escalations_pending: pendingEsc,
    webhook_deliveries_total: deliveries,
    webhook_deliveries_failed: failedDeliveries,
    users_total: users,
    timestamp: new Date().toISOString(),
  };

  if (new URL(request.url).searchParams.get('format') === 'prometheus') {
    const lines: string[] = [
      `# HELP rcm_claims_total Total claims`,
      `# TYPE rcm_claims_total gauge`,
      `rcm_claims_total ${metrics.claims_total}`,
      `# TYPE rcm_claims_by_status gauge`,
      ...Object.entries(statusCounts).map(([s, n]) => `rcm_claims_by_status{status="${s}"} ${n}`),
      `# TYPE rcm_collection_rate_pct gauge`,
      `rcm_collection_rate_pct ${metrics.collection_rate_pct}`,
      `# TYPE rcm_escalations_pending gauge`,
      `rcm_escalations_pending ${metrics.escalations_pending}`,
      `# TYPE rcm_webhook_deliveries_failed gauge`,
      `rcm_webhook_deliveries_failed ${metrics.webhook_deliveries_failed}`,
    ];
    return new NextResponse(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; version=0.0.4' } });
  }

  return NextResponse.json(metrics);
}
