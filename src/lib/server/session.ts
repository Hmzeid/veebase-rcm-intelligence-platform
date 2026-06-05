/**
 * Stateless signed-cookie sessions for the optional UI auth gate.
 *
 * Uses the Web Crypto API (available in both the Edge middleware runtime and
 * the Node route-handler runtime), so the same verifier runs in middleware and
 * in API routes. Tokens are `base64url(payload).base64url(hmac)`.
 *
 * UI auth is OFF by default. It activates only when `RCM_UI_PASSWORD` is set.
 */

export const SESSION_COOKIE = 'rcm_session';
const DEFAULT_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export function uiAuthEnabled(): boolean {
  return process.env.RCM_AUTH_ENABLED === 'true' || !!process.env.RCM_UI_PASSWORD;
}

export function expectedUser(): string {
  return process.env.RCM_UI_USER || 'admin';
}

// Per-process random secret used ONLY when RCM_SESSION_SECRET is unset. This is
// never a known constant (so tokens can't be forged with a public default), but
// sessions won't survive a restart or span multiple instances — set
// RCM_SESSION_SECRET in production. The UI password is intentionally NOT reused
// as the signing key.
let ephemeralSecret: string | null = null;

function sessionSecret(): string {
  const configured = process.env.RCM_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (!ephemeralSecret) {
    const rnd = (globalThis.crypto ?? crypto).getRandomValues(new Uint8Array(32));
    ephemeralSecret = b64urlEncode(rnd);
    if (uiAuthEnabled()) {
      console.warn('[session] RCM_SESSION_SECRET is not set — using an ephemeral per-process secret. Set it for stable, multi-instance sessions.');
    }
  }
  return ephemeralSecret;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export interface SessionData {
  user: string;
  role: string;
  uid?: string;
}

export async function createSessionToken(
  user: string,
  role = 'ADMIN',
  uid?: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const payload = JSON.stringify({ u: user, r: role, id: uid, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const payloadB64 = b64urlEncode(new TextEncoder().encode(payload));
  const sig = b64urlEncode(await hmac(payloadB64));
  return `${payloadB64}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionData | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null; // reject malformed / multi-segment tokens
  const [payloadB64, sig] = parts;
  const expected = b64urlEncode(await hmac(payloadB64));
  // Constant-time-ish comparison.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { user: String(payload.u), role: String(payload.r ?? 'ADMIN'), uid: payload.id ? String(payload.id) : undefined };
  } catch {
    return null;
  }
}
