import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, uiAuthEnabled, SESSION_COOKIE } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/session — current session state. */
export async function GET(request: NextRequest) {
  if (!uiAuthEnabled()) return NextResponse.json({ authEnabled: false, user: null });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return NextResponse.json({ authEnabled: true, user: session?.user ?? null });
}
