import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/server/session';

/**
 * Edge middleware for the integration API surface.
 *
 *  • Adds a correlation `X-Request-Id` to every response.
 *  • Handles CORS (configurable allow-list) including preflight for /api/v1.
 *  • Applies a simple in-memory rate limit per API key / client IP.
 *
 * The rate-limit state is per worker instance — adequate for single-instance
 * deployments; front a shared store (e.g. Redis) for multi-instance scale-out.
 */

const WINDOW_MS = Number(process.env.RCM_RATE_WINDOW_MS ?? 60_000);
const MAX_REQUESTS = Number(process.env.RCM_RATE_LIMIT ?? 240);
const ALLOWED_ORIGINS = (process.env.RCM_CORS_ORIGINS ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function rateLimit(key: string): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: MAX_REQUESTS - 1, resetAt };
  }
  bucket.count += 1;
  const ok = bucket.count <= MAX_REQUESTS;
  return { ok, remaining: Math.max(0, MAX_REQUESTS - bucket.count), resetAt: bucket.resetAt };
}

function corsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (ALLOWED_ORIGINS.includes('*')) return origin ?? '*';
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] ?? '*';
}

function requestId(): string {
  // crypto.randomUUID is available on the Edge runtime.
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// Paths that remain accessible without a UI session (auth endpoints, the login
// page, the API-key-protected integration surface, health, and API docs).
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/v1') ||
    pathname === '/api/health' ||
    pathname === '/api/openapi.json' ||
    pathname === '/docs'
  );
}

export async function middleware(request: NextRequest) {
  const rid = request.headers.get('x-request-id') ?? requestId();
  const { pathname } = request.nextUrl;
  const isApiV1 = pathname.startsWith('/api/v1');

  // Optional UI auth gate — active only when RCM_UI_PASSWORD is configured.
  if (process.env.RCM_UI_PASSWORD && !isPublicPath(pathname)) {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized', message: 'UI session required.' }, { status: 401, headers: { 'X-Request-Id': rid } });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // CORS preflight for the integration API.
  if (isApiV1 && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin(request),
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Idempotency-Key',
        'Access-Control-Max-Age': '86400',
        'X-Request-Id': rid,
      },
    });
  }

  if (isApiV1) {
    const apiKey = request.headers.get('x-api-key') ?? request.headers.get('authorization') ?? '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
    const limitKey = apiKey ? `k:${apiKey.slice(-16)}` : `ip:${ip}`;
    const { ok, remaining, resetAt } = rateLimit(limitKey);

    if (!ok) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded. Retry later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
            'X-Request-Id': rid,
            'Access-Control-Allow-Origin': corsOrigin(request),
          },
        },
      );
    }

    const res = NextResponse.next();
    res.headers.set('X-Request-Id', rid);
    res.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));
    res.headers.set('Access-Control-Allow-Origin', corsOrigin(request));
    return res;
  }

  const res = NextResponse.next();
  res.headers.set('X-Request-Id', rid);
  return res;
}

export const config = {
  // Run on app pages and API routes; skip Next internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpe?g|svg|gif|ico|webp|css|js|map|woff2?|ttf)$).*)',
  ],
};

