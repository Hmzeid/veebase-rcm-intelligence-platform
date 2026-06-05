import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createApiKey } from '@/lib/server/auth';
import { parseBody, ApiKeySchema } from '@/lib/validation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/keys — list API keys (secrets are never returned). */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'read');
  if ('error' in auth) return auth.error;
  const keys = await db.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: safeJson(k.scopes, ['read']),
      active: k.active,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/v1/keys — provision a new API key.
 * Body: { name, scopes?: string[] }. Returns the secret ONCE.
 *
 * Note: while no keys exist the gateway runs in open bootstrap mode, so this
 * first call needs no credentials. After the first key is created, auth is
 * enforced for all /api/v1 routes.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'write');
  if ('error' in auth) return auth.error;
  const parsed = await parseBody(request, ApiKeySchema);
  if (!parsed.ok) return parsed.response;
  const scopes = parsed.data.scopes && parsed.data.scopes.length ? parsed.data.scopes : ['read', 'write'];
  const key = await createApiKey(parsed.data.name, scopes, auth.ctx.name);
  return NextResponse.json(
    { ...key, note: 'Store this secret securely — it will not be shown again. Send it as the X-API-Key header.' },
    { status: 201 },
  );
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
