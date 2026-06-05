import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/server/require-session';
import { hashPassword } from '@/lib/server/passwords';
import { ROLES, isRole } from '@/lib/server/rbac';
import { writeAudit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

/** GET /api/users — list users (requires users.manage). Passwords never returned. */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request, 'users.manage');
  if ('error' in auth) return auth.error;
  const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id, email: u.email, name: u.name, role: u.role, active: u.active,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString(),
    })),
    roles: ROLES,
  });
}

/** POST /api/users — create a user (requires users.manage). Body: { email, name, password, role }. */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request, 'users.manage');
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  const role = String(body.role ?? 'VIEWER');

  if (!email || !name || password.length < 6) {
    return NextResponse.json({ error: 'email, name, and a password (≥6 chars) are required' }, { status: 422 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ error: `role must be one of: ${ROLES.join(', ')}` }, { status: 422 });
  }

  try {
    const user = await db.user.create({
      data: { email, name, role, passwordHash: hashPassword(password) },
    });
    await writeAudit({
      action: 'AGENT_OVERRIDE', actor: auth.ctx.user, actorRole: auth.ctx.role,
      details: `User "${name}" <${email}> created with role ${role}.`,
      newValue: role, riskLevel: 'MEDIUM', tags: ['USER_MGMT'], source: 'ui',
    });
    return NextResponse.json({ user: { id: user.id, email, name, role, active: true } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
  }
}
