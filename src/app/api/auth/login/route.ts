import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, uiAuthEnabled, expectedUser, SESSION_COOKIE } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** POST /api/auth/login — exchange credentials for a signed session cookie. */
export async function POST(request: NextRequest) {
  if (!uiAuthEnabled()) {
    return NextResponse.json({ ok: true, message: 'UI auth is disabled; no login required.' });
  }
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? '');
  const password = String(body.password ?? '');

  if (username !== expectedUser() || password !== process.env.RCM_UI_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true, user: username });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}
