/**
 * Role-Based Access Control.
 *
 * Five roles map to a set of capabilities. Routes and the UI check capabilities
 * (not roles directly) so the policy can evolve without touching call sites.
 */

export type Role = 'ADMIN' | 'RCM_MANAGER' | 'BILLER' | 'COMPLIANCE' | 'VIEWER';

export const ROLES: Role[] = ['ADMIN', 'RCM_MANAGER', 'BILLER', 'COMPLIANCE', 'VIEWER'];

export type Capability =
  | 'claims.view'
  | 'claims.create'
  | 'claims.process'
  | 'escalation.acknowledge'
  | 'escalation.resolve'
  | 'escalation.resolve.l4' // resolve high-severity (level 4+) escalations
  | 'writeoff.approve'
  | 'audit.view'
  | 'ai.manage'
  | 'keys.manage'
  | 'webhooks.manage'
  | 'settings.manage'
  | 'users.manage';

const MATRIX: Record<Role, Capability[]> = {
  ADMIN: [
    'claims.view', 'claims.create', 'claims.process',
    'escalation.acknowledge', 'escalation.resolve', 'escalation.resolve.l4',
    'writeoff.approve', 'audit.view', 'ai.manage', 'keys.manage',
    'webhooks.manage', 'settings.manage', 'users.manage',
  ],
  RCM_MANAGER: [
    'claims.view', 'claims.create', 'claims.process',
    'escalation.acknowledge', 'escalation.resolve', 'escalation.resolve.l4',
    'writeoff.approve', 'audit.view', 'ai.manage', 'webhooks.manage', 'settings.manage',
  ],
  BILLER: [
    'claims.view', 'claims.create', 'claims.process',
    'escalation.acknowledge', 'escalation.resolve',
  ],
  COMPLIANCE: [
    'claims.view', 'audit.view',
    'escalation.acknowledge', 'escalation.resolve', 'escalation.resolve.l4',
  ],
  VIEWER: ['claims.view'],
};

export function capabilitiesFor(role: Role): Capability[] {
  return MATRIX[role] ?? MATRIX.VIEWER;
}

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return capabilitiesFor(role).includes(capability);
}

export function isRole(value: string | undefined | null): value is Role {
  return !!value && (ROLES as string[]).includes(value);
}
