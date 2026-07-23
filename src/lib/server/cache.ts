import { valkeyGetJsonWithTtl, valkeySetJson } from "$lib/server/valkey";
import type { Tables } from "$lib/types/database.types";

// ── LRU Cache ──────────────────────────────────────────────────────────────

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type LRUCacheOptions = {
  /**
   * When set, getOrSet also reads/writes Valkey under `lk:{namespace}:…`
   * so pm2 workers share one cache. Falls back to memory-only if VALKEY_URL
   * is unset or Valkey is unreachable.
   */
  redisNamespace?: string;
  /**
   * When true, an expired L1 entry is served immediately while a background
   * refresh runs (stale-while-revalidate). Avoids multi-second stalls on TTL
   * expiry for heavy keys like /api/static.
   */
  staleWhileRevalidate?: boolean;
};

export class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  /** In-flight computations keyed by cache key — collapses concurrent misses. */
  private inflight = new Map<string, Promise<T>>();
  private readonly redisNamespace: string | undefined;
  private readonly staleWhileRevalidate: boolean;

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number,
    options?: LRUCacheOptions,
  ) {
    this.redisNamespace = options?.redisNamespace;
    this.staleWhileRevalidate = options?.staleWhileRevalidate ?? false;
  }

  private redisKey(key: string): string | null {
    return this.redisNamespace ? `lk:${this.redisNamespace}:${key}` : null;
  }

  /** Fresh entry only — expired entries are removed (unless kept for SWR via peek). */
  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      if (!this.staleWhileRevalidate) {
        this.map.delete(key);
      }
      return undefined;
    }
    // Refresh LRU position
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /** Return value even if TTL expired (does not promote LRU / does not delete). */
  private getStale(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      // Evict oldest entry
      this.map.delete(this.map.keys().next().value!);
    }
    const ttl = Math.max(0, ttlMs);
    this.map.set(key, { value, expiresAt: Date.now() + ttl });
  }

  /**
   * Return cached value or compute + store it.
   * Concurrent misses for the same key share one in-flight Promise (singleflight).
   * With `redisNamespace`, also checks/writes Valkey so workers share state.
   * Valkey hits populate L1 with min(local ttl, remaining Redis TTL).
   * With `staleWhileRevalidate`, expired L1 hits return immediately and refresh
   * in the background.
   */
  async getOrSet(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    if (this.staleWhileRevalidate) {
      const stale = this.getStale(key);
      if (stale !== undefined) {
        if (!this.inflight.has(key)) {
          const refresh = this.computeAndStore(key, fn);
          this.inflight.set(key, refresh);
          void refresh.catch(() => {});
        }
        return stale;
      }
    }

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const pending = this.computeAndStore(key, fn);
    this.inflight.set(key, pending);
    return pending;
  }

  private computeAndStore(key: string, fn: () => Promise<T>): Promise<T> {
    return Promise.resolve()
      .then(async () => {
        const again = this.get(key);
        if (again !== undefined) return again;

        const rKey = this.redisKey(key);
        if (rKey) {
          const remote = await valkeyGetJsonWithTtl<T>(rKey);
          if (remote !== undefined) {
            const ttl = Math.min(this.ttlMs, remote.ttlMs);
            if (ttl > 0) {
              this.set(key, remote.value, ttl);
              return remote.value;
            }
          }
        }

        const value = await fn();
        this.set(key, value);
        if (rKey) {
          void valkeySetJson(rKey, value, this.ttlMs);
        }
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
  }

  invalidate(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

// ── Rate Limiter ───────────────────────────────────────────────────────────

type RateWindow = {
  count: number;
  resetAt: number;
};

/**
 * Fixed-window rate limiter keyed by IP address.
 * @param maxRequests — allowed requests per window
 * @param windowMs    — window duration in milliseconds
 */
export class RateLimiter {
  private windows = new Map<string, RateWindow>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {
    // Periodically clean up expired windows to prevent unbounded growth
    setInterval(() => this.cleanup(), this.windowMs * 2);
  }

  /**
   * Returns true if the request is allowed, false if rate-limited.
   */
  check(ip: string): boolean {
    const now = Date.now();
    const existing = this.windows.get(ip);

    if (!existing || now > existing.resetAt) {
      this.windows.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (existing.count >= this.maxRequests) return false;

    existing.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, window] of this.windows) {
      if (now > window.resetAt) this.windows.delete(ip);
    }
  }
}

// ── Shared singletons ──────────────────────────────────────────────────────
// Memory L1 per process + Valkey L2 when VALKEY_URL / REDIS_URL is set
// (see docker-compose.yml). Keep pm2 -i max; workers share Valkey.

type Character = Tables<"characters">;

const TTL_15_MIN = 15 * 60 * 1000;

/**
 * Cache for the characters table — changes only on patch day.
 * Single entry; keyed by the constant string "characters".
 */
export const charactersCache = new LRUCache<Character[]>(1, TTL_15_MIN, {
  redisNamespace: "characters",
});

/**
 * Cache for per-user Supabase RPC results.
 * Key: `${rpcName}:${versionNumber}:${sortedCharNames}`
 * Holds up to 2 000 distinct character-list combinations in L1.
 */
export const rpcCache = new LRUCache<unknown>(2_000, TTL_15_MIN, {
  redisNamespace: "rpc",
});

/**
 * Rate limiter for user-facing API routes.
 * 60 requests per minute per IP — generous for normal use, blocks scrapers.
 * (Still per-process; move to Valkey later if needed.)
 */
export const apiRateLimiter = new RateLimiter(60, 60_000);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the client IP from a SvelteKit RequestEvent.
 * Respects Cloudflare's CF-Connecting-IP header when present.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Builds a stable cache key from an RPC name, version, and character list.
 * Sorting ensures ["Furina","Xilonen"] and ["Xilonen","Furina"] hit the same entry.
 */
export function buildRpcKey(
  rpcName: string,
  versionNumber: number,
  characters: string[],
): string {
  return `${rpcName}:${versionNumber}:${[...characters].sort().join(",")}`;
}
