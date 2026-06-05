import { test, expect, describe, beforeAll } from 'bun:test';
import { createSessionToken, verifySessionToken } from '../src/lib/server/session';

beforeAll(() => {
  process.env.RCM_SESSION_SECRET = 'test-secret-key';
});

describe('session tokens', () => {
  test('round-trips a valid token', async () => {
    const token = await createSessionToken('admin');
    const session = await verifySessionToken(token);
    expect(session?.user).toBe('admin');
  });

  test('rejects a tampered token', async () => {
    const token = await createSessionToken('admin');
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  test('rejects an expired token', async () => {
    const token = await createSessionToken('admin', 'ADMIN', undefined, -10); // already expired
    expect(await verifySessionToken(token)).toBeNull();
  });

  test('carries the role in the session', async () => {
    const token = await createSessionToken('manager', 'RCM_MANAGER');
    const session = await verifySessionToken(token);
    expect(session?.role).toBe('RCM_MANAGER');
  });

  test('rejects malformed input', async () => {
    expect(await verifySessionToken('')).toBeNull();
    expect(await verifySessionToken('garbage')).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});
