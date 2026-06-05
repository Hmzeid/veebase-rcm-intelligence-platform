import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, uiAuthEnabled, expectedUser, SESSION_COOKIE } from '@/lib/server/session';
import { verifyPassword, hashPassword } from '@/lib/server/passwords';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Precomputed dummy hash so a non-existent user still pays the scrypt cost,
// preventing user-enumeration via response timing.
const DUMMY_HASH = hashPassword('user-enumeration-guard');

function constantTimeEquals(a: string, b: string): boolean {
  const da = crypto.createHash('sha256').update(a).digest();
  const db_ = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(da, db_);
}

/**
 * POST /api/auth/login — exchange credentials for a signed session cookie.
 *
 * Authenticates against the User table (RBAC) when users exist; otherwise falls
 * back to the env single-user (RCM_UI_USER / RCM_UI_PASSWORD) as an ADMIN, so
 * the platform is usable before any users are provisioned.
 */
export async function POST(request: NextRequest) {
  if (!uiAuthEnabled()) {
    return NextResponse.json({ ok: true, message: 'UI auth is disabled; no login required.' });
  }
  const body = await request.json().catch(() => ({}));
  const identifier = String(body.username ?? body.email ?? '').trim();
  const password = String(body.password ?? '');

  let authedUser: { name: string; role: string; uid?: string } | null = null;

  // 1) Try the User table (match by email or name). Always run a scrypt verify
  // (against a dummy hash when the user is absent) so timing is constant.
  try {
    const user = await db.user.findFirst({
      where: { active: true, OR: [{ email: identifier.toLowerCase() }, { name: identifier }] },
    });
    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (user && ok) {
      authedUser = { name: user.name, role: user.role, uid: user.id };
      db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
    }
  } catch {
    /* table may not exist yet → fall through to env user */
  }

  // 2) Fall back to the env single-user (constant-time comparison).
  if (!authedUser && process.env.RCM_UI_PASSWORD) {
    const idOk = constantTimeEquals(identifier, expectedUser());
    const pwOk = constantTimeEquals(password, process.env.RCM_UI_PASSWORD);
    if (idOk && pwOk) {
      authedUser = { name: identifier, role: 'ADMIN' };
    }
  }

  if (!authedUser) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSessionToken(authedUser.name, authedUser.role, authedUser.uid);
  const res = NextResponse.json({ ok: true, user: authedUser.name, role: authedUser.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}
