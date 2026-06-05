import crypto from 'node:crypto';

/**
 * Field-level encryption-at-rest for sensitive PHI (e.g. national IDs).
 *
 * Enabled only when RCM_ENCRYPTION_KEY is set; otherwise values are stored as
 * plaintext (the open demo default). Encrypted values are prefixed `enc:1:` and
 * `decryptField` transparently passes through plaintext, so enabling encryption
 * is backward compatible with existing rows.
 *
 * Algorithm: AES-256-GCM with a random 12-byte IV per value.
 */

const PREFIX = 'enc:1:';

export function encryptionEnabled(): boolean {
  return !!process.env.RCM_ENCRYPTION_KEY?.trim();
}

function key(): Buffer {
  const raw = process.env.RCM_ENCRYPTION_KEY!.trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.scryptSync(raw, 'rcm-field-encryption', 32);
}

export function encryptField(plain: string | null | undefined): string {
  if (plain == null || plain === '') return plain ?? '';
  if (!encryptionEnabled()) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

export function decryptField(stored: string | null | undefined): string {
  if (stored == null || stored === '') return stored ?? '';
  if (!stored.startsWith(PREFIX)) return stored; // plaintext / legacy
  if (!encryptionEnabled()) {
    // Encrypted value but no key configured — fail loudly rather than leak the
    // ciphertext as if it were the plaintext value.
    throw new Error('Encrypted field encountered but RCM_ENCRYPTION_KEY is not set');
  }
  const [, , ivHex, tagHex, ctHex] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  // GCM .final() throws on tag mismatch (tampering / wrong key) — let it propagate.
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
}

/** Redact an Egyptian-national-ID-like 14-digit run for safe logging. */
export function redactPII(text: string): string {
  return text.replace(/\b\d{14}\b/g, (m) => `${m.slice(0, 3)}********${m.slice(-3)}`);
}
