import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { encryptField, decryptField, encryptionEnabled, redactPII } from '../src/lib/server/crypto-field';

const SAVED = process.env.RCM_ENCRYPTION_KEY;
afterEach(() => {
  if (SAVED === undefined) delete process.env.RCM_ENCRYPTION_KEY;
  else process.env.RCM_ENCRYPTION_KEY = SAVED;
});

describe('field encryption disabled (no key)', () => {
  beforeEach(() => { delete process.env.RCM_ENCRYPTION_KEY; });

  test('passes values through as plaintext', () => {
    expect(encryptionEnabled()).toBe(false);
    expect(encryptField('29901010100011')).toBe('29901010100011');
    expect(decryptField('29901010100011')).toBe('29901010100011');
  });
});

describe('field encryption enabled', () => {
  beforeEach(() => { process.env.RCM_ENCRYPTION_KEY = 'a-test-encryption-passphrase'; });

  test('round-trips and produces non-plaintext ciphertext', () => {
    const enc = encryptField('29901010100011');
    expect(enc.startsWith('enc:1:')).toBe(true);
    expect(enc).not.toContain('29901010100011');
    expect(decryptField(enc)).toBe('29901010100011');
  });

  test('decrypts legacy plaintext transparently (backward compatible)', () => {
    expect(decryptField('plain-legacy')).toBe('plain-legacy');
  });

  test('uses a fresh IV per call', () => {
    expect(encryptField('same')).not.toBe(encryptField('same'));
  });

  test('handles empty values', () => {
    expect(encryptField('')).toBe('');
    expect(decryptField('')).toBe('');
  });
});

describe('PII redaction', () => {
  test('masks 14-digit national IDs', () => {
    expect(redactPII('ID 29901010100011 on file')).toBe('ID 299********011 on file');
  });
});
