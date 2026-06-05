import dns from 'node:dns/promises';

/**
 * SSRF protection for user-supplied webhook URLs that the server fetches.
 * Blocks non-http(s) schemes and hosts that resolve to private, loopback,
 * link-local (incl. cloud metadata 169.254.169.254), or unique-local ranges.
 *
 * Set RCM_WEBHOOK_ALLOW_PRIVATE=true to permit private targets (dev/testing).
 */

function ip4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // be safe
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function ip6IsPrivate(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === '::1' || s === '::') return true;
  if (s.startsWith('fc') || s.startsWith('fd')) return true; // unique-local
  if (s.startsWith('fe80')) return true; // link-local
  if (s.startsWith('::ffff:')) return ip4IsPrivate(s.replace('::ffff:', '')); // mapped v4
  return false;
}

function isPrivateAddr(addr: string): boolean {
  return addr.includes(':') ? ip6IsPrivate(addr) : ip4IsPrivate(addr);
}

export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

export async function checkOutboundUrl(rawUrl: string): Promise<UrlCheck> {
  if (process.env.RCM_WEBHOOK_ALLOW_PRIVATE === 'true') return { ok: true };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'only http(s) URLs are allowed' };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, reason: 'internal hostname is not allowed' };
  }
  // Literal IP?
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateAddr(host)) return { ok: false, reason: 'private/loopback address is not allowed' };
    return { ok: true };
  }
  // Resolve and check every returned address (guards against DNS pointing inward).
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: 'host does not resolve' };
    for (const r of records) {
      if (isPrivateAddr(r.address)) return { ok: false, reason: 'host resolves to a private address' };
    }
  } catch {
    return { ok: false, reason: 'host does not resolve' };
  }
  return { ok: true };
}
