import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, uiAuthEnabled, SESSION_COOKIE } from '@/lib/server/session';
import { capabilitiesFor, isRole } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

/** GET /api/auth/session — current session state, role, and capabilities. */
export async function GET(request: NextRequest) {
  if (!uiAuthEnabled()) {
    // Auth disabled → an implicit admin so the open demo keeps full control.
    return NextResponse.json({ authEnabled: false, user: null, role: 'ADMIN', capabilities: capabilitiesFor('ADMIN') });
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ authEnabled: true, user: null, role: null, capabilities: [] });
  const role = isRole(session.role) ? session.role : 'VIEWER';
  return NextResponse.json({ authEnabled: true, user: session.user, role, capabilities: capabilitiesFor(role) });
}
