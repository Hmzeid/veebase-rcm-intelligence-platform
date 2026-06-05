import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { checkOutboundUrl } from '../src/lib/server/ssrf';
import { encryptField, decryptField } from '../src/lib/server/crypto-field';

describe('SSRF guard (checkOutboundUrl)', () => {
  const saved = process.env.RCM_WEBHOOK_ALLOW_PRIVATE;
  beforeEach(() => { delete process.env.RCM_WEBHOOK_ALLOW_PRIVATE; });
  afterEach(() => { if (saved === undefined) delete process.env.RCM_WEBHOOK_ALLOW_PRIVATE; else process.env.RCM_WEBHOOK_ALLOW_PRIVATE = saved; });

  test('rejects loopback and link-local literal IPs', async () => {
    expect((await checkOutboundUrl('http://127.0.0.1/hook')).ok).toBe(false);
    expect((await checkOutboundUrl('http://169.254.169.254/latest/meta-data')).ok).toBe(false); // cloud metadata
    expect((await checkOutboundUrl('http://10.0.0.5/x')).ok).toBe(false);
    expect((await checkOutboundUrl('http://192.168.1.10/x')).ok).toBe(false);
    expect((await checkOutboundUrl('http://[::1]/x')).ok).toBe(false);
  });

  test('rejects internal hostnames and non-http schemes', async () => {
    expect((await checkOutboundUrl('http://localhost/x')).ok).toBe(false);
    expect((await checkOutboundUrl('http://svc.internal/x')).ok).toBe(false);
    expect((await checkOutboundUrl('ftp://example.com/x')).ok).toBe(false);
    expect((await checkOutboundUrl('file:///etc/passwd')).ok).toBe(false);
    expect((await checkOutboundUrl('not-a-url')).ok).toBe(false);
  });

  test('allows a public literal IP', async () => {
    expect((await checkOutboundUrl('https://8.8.8.8/hook')).ok).toBe(true);
  });

  test('override permits private targets (dev/testing)', async () => {
    process.env.RCM_WEBHOOK_ALLOW_PRIVATE = 'true';
    expect((await checkOutboundUrl('http://127.0.0.1/hook')).ok).toBe(true);
  });
});

describe('field decryption fails closed', () => {
  const saved = process.env.RCM_ENCRYPTION_KEY;
  afterEach(() => { if (saved === undefined) delete process.env.RCM_ENCRYPTION_KEY; else process.env.RCM_ENCRYPTION_KEY = saved; });

  test('throws on an encrypted value when no key is configured (no ciphertext leak)', () => {
    process.env.RCM_ENCRYPTION_KEY = 'k';
    const enc = encryptField('29901010100011');
    delete process.env.RCM_ENCRYPTION_KEY;
    expect(() => decryptField(enc)).toThrow();
  });

  test('throws on a tampered ciphertext (GCM auth)', () => {
    process.env.RCM_ENCRYPTION_KEY = 'k';
    const enc = encryptField('secret');
    const tampered = enc.slice(0, -2) + (enc.endsWith('aa') ? 'bb' : 'aa');
    expect(() => decryptField(tampered)).toThrow();
  });
});
