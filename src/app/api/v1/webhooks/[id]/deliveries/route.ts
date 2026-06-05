import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/webhooks/:id/deliveries — recent delivery attempts for a webhook. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const rows = await db.webhookDelivery.findMany({
    where: { webhookId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({
    deliveries: rows.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      statusCode: d.statusCode,
      attempts: d.attempts,
      responseBody: d.responseBody,
      createdAt: d.createdAt.toISOString(),
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
    })),
  });
}
