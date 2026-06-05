import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { parseBody, WebhookSchema } from '@/lib/validation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/webhooks — list registered webhook subscriptions. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;
  const hooks = await db.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    webhooks: hooks.map((h) => ({
      id: h.id,
      url: h.url,
      events: safeJson(h.events, ['*']),
      active: h.active,
      description: h.description,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/v1/webhooks — register an outbound webhook.
 * Body: { url, events?: string[], description? }
 * Returns the signing secret ONCE.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;
  const parsed = await parseBody(request, WebhookSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const secret = 'whsec_' + crypto.randomBytes(20).toString('hex');
  const hook = await db.webhook.create({
    data: {
      url: body.url,
      secret,
      events: JSON.stringify(body.events && body.events.length ? body.events : ['*']),
      description: body.description ?? '',
    },
  });
  return NextResponse.json(
    {
      id: hook.id,
      url: hook.url,
      events: safeJson(hook.events, ['*']),
      secret, // shown once — used to verify the X-RCM-Signature HMAC
      note: 'Store this secret securely. Payloads are signed: X-RCM-Signature: sha256=HMAC_SHA256(secret, body).',
    },
    { status: 201 },
  );
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
