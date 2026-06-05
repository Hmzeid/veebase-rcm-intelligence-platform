import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const PREFIX = 'rcm_live_';

export interface AuthContext {
  keyId: string;
  name: string;
  scopes: string[];
}

export function hashKey(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Generate a new API key. Returns the plaintext secret ONCE (not stored). */
export async function createApiKey(name: string, scopes: string[] = ['read', 'write'], createdBy = 'system') {
  const secret = PREFIX + crypto.randomBytes(24).toString('hex');
  const keyHash = hashKey(secret);
  const prefix = secret.slice(0, 12);
  const record = await db.apiKey.create({
    data: { name, keyHash, prefix, scopes: JSON.stringify(scopes), createdBy },
  });
  return { id: record.id, name, secret, prefix, scopes };
}

/**
 * Authenticate an inbound API request. Looks for the key in the
 * `X-API-Key` header or `Authorization: Bearer <key>`.
 *
 * Bootstrapping rule: if NO API keys exist yet, the gateway runs in "open"
 * mode so the platform is usable out-of-the-box; once at least one key is
 * provisioned, authentication is enforced. An `RCM_MASTER_KEY` env var is
 * always accepted when set.
 */
export async function authenticate(req: NextRequest): Promise<AuthContext | null> {
  const header = req.headers.get('x-api-key') ?? '';
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const provided = header || bearer;

  // Master key escape hatch for trusted server-to-server callers.
  const master = process.env.RCM_MASTER_KEY?.trim();
  if (master && provided && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(master))) {
    return { keyId: 'master', name: 'master', scopes: ['read', 'write', 'admin'] };
  }

  let keyCount = 0;
  try {
    keyCount = await db.apiKey.count({ where: { active: true } });
  } catch {
    keyCount = 0;
  }

  if (keyCount === 0 && process.env.RCM_REQUIRE_API_AUTH !== 'true') {
    // Open bootstrap mode — no keys provisioned yet. Disable by setting
    // RCM_REQUIRE_API_AUTH=true (then provision the first key with RCM_MASTER_KEY).
    return { keyId: 'bootstrap', name: 'bootstrap', scopes: ['read', 'write'] };
  }

  if (!provided) return null;

  const keyHash = hashKey(provided);
  const record = await db.apiKey.findUnique({ where: { keyHash } });
  if (!record || !record.active) return null;

  // Touch lastUsedAt (best-effort).
  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  let scopes: string[] = ['read'];
  try { scopes = JSON.parse(record.scopes); } catch { /* keep default */ }
  return { keyId: record.id, name: record.name, scopes };
}

/** Guard helper for route handlers. Returns a 401 response when unauthorized. */
export async function requireAuth(
  req: NextRequest,
  scope?: 'read' | 'write' | 'admin',
): Promise<{ ctx: AuthContext } | { error: NextResponse }> {
  const ctx = await authenticate(req);
  if (!ctx) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'Provide a valid API key in the X-API-Key header.' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
      ),
    };
  }
  if (scope && !ctx.scopes.includes(scope) && !ctx.scopes.includes('admin')) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden', message: `This API key lacks the "${scope}" scope.` },
        { status: 403 },
      ),
    };
  }
  return { ctx };
}
