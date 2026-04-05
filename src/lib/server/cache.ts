// ── LRU Cache ──────────────────────────────────────────────────────────────

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU position
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      // Evict oldest entry
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Convenience: return cached value or compute + store it. */
  async getOrSet(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    this.set(key, value);
    return value;
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
// These live in server memory for the lifetime of the Node process.

const TTL_15_MIN = 15 * 60 * 1000;

/**
 * Cache for per-user Supabase RPC results.
 * Key: `${rpcName}:${versionNumber}:${sortedCharNames}`
 * Holds up to 2 000 distinct character-list combinations.
 */
export const rpcCache = new LRUCache<unknown>(2_000, TTL_15_MIN);

/**
 * Rate limiter for user-facing API routes.
 * 60 requests per minute per IP — generous for normal use, blocks scrapers.
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
