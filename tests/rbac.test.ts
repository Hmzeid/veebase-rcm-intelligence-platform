import { test, expect, describe } from 'bun:test';
import { hashPassword, verifyPassword } from '../src/lib/server/passwords';
import { can, capabilitiesFor, isRole, ROLES } from '../src/lib/server/rbac';

describe('password hashing', () => {
  test('hashes and verifies correctly', () => {
    const h = hashPassword('s3cret-pass');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('s3cret-pass', h)).toBe(true);
  });

  test('rejects the wrong password', () => {
    const h = hashPassword('right');
    expect(verifyPassword('wrong', h)).toBe(false);
  });

  test('produces a unique salt per hash', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  test('rejects malformed stored hashes', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});

describe('rbac capability matrix', () => {
  test('admin can do everything sensitive', () => {
    expect(can('ADMIN', 'users.manage')).toBe(true);
    expect(can('ADMIN', 'writeoff.approve')).toBe(true);
    expect(can('ADMIN', 'ai.manage')).toBe(true);
  });

  test('biller can process claims but not approve write-offs or manage users', () => {
    expect(can('BILLER', 'claims.process')).toBe(true);
    expect(can('BILLER', 'writeoff.approve')).toBe(false);
    expect(can('BILLER', 'users.manage')).toBe(false);
    expect(can('BILLER', 'escalation.resolve.l4')).toBe(false);
  });

  test('compliance can view audit and resolve high-severity escalations but cannot create claims', () => {
    expect(can('COMPLIANCE', 'audit.view')).toBe(true);
    expect(can('COMPLIANCE', 'escalation.resolve.l4')).toBe(true);
    expect(can('COMPLIANCE', 'claims.create')).toBe(false);
  });

  test('viewer can only view claims', () => {
    expect(can('VIEWER', 'claims.view')).toBe(true);
    expect(can('VIEWER', 'claims.create')).toBe(false);
    expect(capabilitiesFor('VIEWER')).toEqual(['claims.view']);
  });

  test('unknown / null role grants nothing', () => {
    expect(can(null, 'claims.view')).toBe(false);
    expect(isRole('SUPERUSER')).toBe(false);
    expect(ROLES.every(isRole)).toBe(true);
  });
});
