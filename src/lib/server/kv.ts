/**
 * Tiny KV abstraction for cross-instance coordination (rate limiting, caches).
 *
 * Backends:
 *   • in-memory (default) — per-process; fine for a single instance.
 *   • Redis (when REDIS_URL is set) — shared across instances for horizontal
 *     scale-out. The `ioredis` package is imported dynamically and only if
 *     present, so it remains an optional dependency.
 *
 * Note: idempotency keys are stored in the primary database (Prisma), which is
 * already shared across instances — this KV is for ephemeral counters.
 */

interface RateResult {
  count: number;
  resetAt: number;
}

interface KVBackend {
  incrWithExpiry(key: string, windowMs: number): Promise<RateResult>;
}

// ── in-memory ────────────────────────────────────────────────────────────────

class MemoryKV implements KVBackend {
  private store = new Map<string, RateResult>();
  async incrWithExpiry(key: string, windowMs: number): Promise<RateResult> {
    const now = Date.now();
    const cur = this.store.get(key);
    if (!cur || cur.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      this.store.set(key, next);
      return next;
    }
    cur.count += 1;
    return cur;
  }
}

// ── Redis (optional) ──────────────────────────────────────────────────────────

class RedisKV implements KVBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private client: any) {}
  async incrWithExpiry(key: string, windowMs: number): Promise<RateResult> {
    const count: number = await this.client.incr(key);
    if (count === 1) await this.client.pexpire(key, windowMs);
    let ttl: number = await this.client.pttl(key);
    if (ttl < 0) ttl = windowMs;
    return { count, resetAt: Date.now() + ttl };
  }
}

let backendPromise: Promise<KVBackend> | null = null;

async function getBackend(): Promise<KVBackend> {
  if (backendPromise) return backendPromise;
  backendPromise = (async () => {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      try {
        // Optional dependency — loaded only when REDIS_URL is configured. The
        // specifier is a variable so the bundler/tsc don't require it at build.
        const spec = 'ioredis';
        const mod = (await import(spec).catch(() => null)) as
          | { default: new (u: string) => unknown }
          | null;
        if (mod?.default) {
          const client = new mod.default(url);
          console.log('[kv] using Redis backend');
          return new RedisKV(client);
        }
        console.warn('[kv] REDIS_URL set but "ioredis" not installed — using in-memory backend');
      } catch (e) {
        console.warn('[kv] Redis init failed, using in-memory backend:', e instanceof Error ? e.message : e);
      }
    }
    return new MemoryKV();
  })();
  return backendPromise;
}

export function sharedStoreEnabled(): boolean {
  return !!process.env.REDIS_URL?.trim();
}

export interface RateDecision {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/** Consume one token for `key`. Used for shared (Redis) rate limiting. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateDecision> {
  const backend = await getBackend();
  const { count, resetAt } = await backend.incrWithExpiry(key, windowMs);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt, limit };
}
