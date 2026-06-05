import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, uiAuthEnabled, expectedUser, SESSION_COOKIE } from '@/lib/server/session';
import { verifyPassword } from '@/lib/server/passwords';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

  // 1) Try the User table (match by email or name).
  try {
    const userCount = await db.user.count({ where: { active: true } });
    if (userCount > 0) {
      const user = await db.user.findFirst({
        where: { active: true, OR: [{ email: identifier.toLowerCase() }, { name: identifier }] },
      });
      if (user && verifyPassword(password, user.passwordHash)) {
        authedUser = { name: user.name, role: user.role, uid: user.id };
        db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
      }
    }
  } catch {
    /* table may not exist yet → fall through to env user */
  }

  // 2) Fall back to the env single-user.
  if (!authedUser && process.env.RCM_UI_PASSWORD) {
    if (identifier === expectedUser() && password === process.env.RCM_UI_PASSWORD) {
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
