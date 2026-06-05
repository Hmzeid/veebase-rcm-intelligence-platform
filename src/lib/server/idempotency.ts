import { db } from '@/lib/db';
import type { ClaimRecord } from '@/lib/rcm-types';

/**
 * Idempotent execution for create endpoints. When the caller supplies an
 * `Idempotency-Key` header, the first call runs `fn` and caches the resulting
 * claim; subsequent calls with the same key return the cached claim instead of
 * creating a duplicate. Keys are scoped per API key.
 */
export async function withIdempotency(
  request: Request,
  keyScope: string,
  fn: () => Promise<ClaimRecord>,
): Promise<ClaimRecord> {
  const headerKey = request.headers.get('idempotency-key')?.trim();
  if (!headerKey) return fn();

  const composite = `${keyScope}:${headerKey}`;

  // Return the cached claim if we have seen this key before.
  try {
    const existing = await db.idempotencyKey.findUnique({ where: { key: composite } });
    if (existing?.claimId) {
      const cached = await db.claim.findUnique({ where: { id: existing.claimId } });
      if (cached) {
        const parsed = JSON.parse(existing.response || '{}');
        if (parsed && parsed.id) return parsed as ClaimRecord;
      }
    }
  } catch {
    // table missing / parse error → fall through and just run fn
  }

  const claim = await fn();

  try {
    await db.idempotencyKey.create({
      data: { key: composite, scope: 'claim.create', claimId: claim.id, response: JSON.stringify(claim) },
    });
  } catch {
    // Unique-constraint race: another request created it first — best effort.
  }

  return claim;
}
