import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, uiAuthEnabled, SESSION_COOKIE } from './session';
import { can, isRole, type Capability, type Role } from './rbac';

export interface SessionContext {
  user: string;
  role: Role;
}

/**
 * Guard for internal route handlers that require a UI session and (optionally) a
 * capability. When UI auth is disabled the caller is treated as an implicit
 * ADMIN, so the open demo keeps working.
 */
export async function requireSession(
  request: NextRequest,
  capability?: Capability,
): Promise<{ ctx: SessionContext } | { error: NextResponse }> {
  if (!uiAuthEnabled()) {
    return { ctx: { user: 'system', role: 'ADMIN' } };
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized', message: 'Sign in required.' }, { status: 401 }) };
  }
  const role: Role = isRole(session.role) ? session.role : 'VIEWER';
  if (capability && !can(role, capability)) {
    return { error: NextResponse.json({ error: 'Forbidden', message: `Your role (${role}) lacks "${capability}".` }, { status: 403 }) };
  }
  return { ctx: { user: session.user, role } };
}
