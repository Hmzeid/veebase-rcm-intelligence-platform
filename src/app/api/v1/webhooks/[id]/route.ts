import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/webhooks/:id — remove a webhook subscription. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    await db.webhook.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: id });
}

/** PATCH /api/v1/webhooks/:id — enable/disable or update events. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') data.active = body.active;
  if (Array.isArray(body.events)) data.events = JSON.stringify(body.events);
  if (typeof body.description === 'string') data.description = body.description;
  try {
    const hook = await db.webhook.update({ where: { id }, data });
    return NextResponse.json({ id: hook.id, active: hook.active, events: JSON.parse(hook.events) });
  } catch {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }
}
