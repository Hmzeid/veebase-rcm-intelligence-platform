import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sharedStoreEnabled, consumeRateLimit } from './kv';

const PREFIX = 'rcm_live_';

export interface AuthContext {
  keyId: string;
  name: string;
  scopes: string[];
}

export function hashKey(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Length-safe constant-time string comparison (never throws). */
function constantTimeEquals(a: string, b: string): boolean {
  const da = crypto.createHash('sha256').update(a).digest();
  const db_ = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(da, db_);
}

/**
 * Whether keyless "bootstrap" access is permitted. Explicit env wins; otherwise
 * open only outside production (fail closed in production).
 */
function bootstrapAllowed(): boolean {
  const flag = process.env.RCM_REQUIRE_API_AUTH;
  if (flag === 'true') return false;
  if (flag === 'false') return true;
  return process.env.NODE_ENV !== 'production';
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

  // Master key escape hatch for trusted server-to-server callers. Compare
  // fixed-length SHA-256 digests so timingSafeEqual never throws on a length
  // mismatch (which would otherwise 500 every request once a master key is set).
  const master = process.env.RCM_MASTER_KEY?.trim();
  if (master && provided && constantTimeEquals(provided, master)) {
    return { keyId: 'master', name: 'master', scopes: ['read', 'write', 'admin'] };
  }

  let keyCount = 0;
  try {
    keyCount = await db.apiKey.count({ where: { active: true } });
  } catch {
    keyCount = 0;
  }

  // Bootstrap (open) mode is allowed only outside production. In production it
  // must be explicitly opted into with RCM_REQUIRE_API_AUTH=false — fail closed
  // by default so a deploy-and-forget can't expose the API with zero keys.
  if (keyCount === 0 && bootstrapAllowed()) {
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

  // Cross-instance rate limit — authoritative when a shared store (Redis) is
  // configured. The Edge middleware provides the per-instance first line.
  if (sharedStoreEnabled()) {
    const limit = Number(process.env.RCM_RATE_LIMIT ?? 240);
    const windowMs = Number(process.env.RCM_RATE_WINDOW_MS ?? 60_000);
    const decision = await consumeRateLimit(`rl:${ctx.keyId}`, limit, windowMs);
    if (!decision.ok) {
      return {
        error: NextResponse.json(
          { error: 'Too Many Requests', message: 'Rate limit exceeded (shared).' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((decision.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': '0',
            },
          },
        ),
      };
    }
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
