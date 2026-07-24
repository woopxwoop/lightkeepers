/**
 * Unit tests for LRUCache stale-while-revalidate behavior.
 *
 * Run: pnpm exec tsx --test src/lib/server/cache.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setImmediate as setImm } from "node:timers";
import { LRUCache } from "./cache.ts";

describe("LRUCache stale-while-revalidate", () => {
  let now = 1_000_000;
  const realNow = Date.now;

  beforeEach(() => {
    now = 1_000_000;
    Date.now = () => now;
  });

  afterEach(() => {
    Date.now = realNow;
  });

  function advance(ms: number) {
    now += ms;
  }

  /** Wait for background refresh handlers (Promise + async I/O turns). */
  async function settle() {
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((r) => setImm(r));
    }
  }

  it("serves stale values within maxStaleMs and refreshes in the background", async () => {
    const cache = new LRUCache<string>(10, 1_000, {
      staleWhileRevalidate: true,
      maxStaleMs: 5_000,
    });

    let computes = 0;
    assert.equal(
      await cache.getOrSet("k", async () => {
        computes++;
        return "v1";
      }),
      "v1",
    );
    assert.equal(computes, 1);

    advance(1_001);

    let resolveRefresh!: (v: string) => void;
    let started!: () => void;
    const refreshStarted = new Promise<void>((r) => {
      started = r;
    });

    assert.equal(
      await cache.getOrSet("k", () => {
        computes++;
        started();
        return new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        });
      }),
      "v1",
    );
    await refreshStarted;

    assert.equal(
      await cache.getOrSet("k", async () => {
        computes++;
        return "should-not-run";
      }),
      "v1",
    );
    assert.equal(computes, 2);

    resolveRefresh("v2");
    await settle();

    assert.equal(
      await cache.getOrSet("k", async () => {
        computes++;
        return "should-not-run-2";
      }),
      "v2",
    );
    assert.equal(computes, 2);
  });

  it("collapses concurrent background refreshes through inflight", async () => {
    const cache = new LRUCache<string>(10, 1_000, {
      staleWhileRevalidate: true,
      maxStaleMs: 5_000,
    });

    await cache.getOrSet("k", async () => "v1");
    advance(1_001);

    let computes = 0;
    let resolveRefresh!: (v: string) => void;
    const slow = () => {
      computes++;
      return new Promise<string>((resolve) => {
        resolveRefresh = resolve;
      });
    };

    const [va, vb] = await Promise.all([
      cache.getOrSet("k", slow),
      cache.getOrSet("k", slow),
    ]);
    assert.equal(va, "v1");
    assert.equal(vb, "v1");
    assert.equal(computes, 1);

    resolveRefresh("v2");
    await settle();
  });

  it("applies exponential refresh-failure backoff and retries after retryAfter", async () => {
    const cache = new LRUCache<string>(10, 1_000, {
      staleWhileRevalidate: true,
      maxStaleMs: 60_000,
    });

    await cache.getOrSet("k", async () => "v1");
    advance(1_001);

    let computes = 0;
    const failing = async () => {
      computes++;
      throw new Error("upstream down");
    };

    assert.equal(await cache.getOrSet("k", failing), "v1");
    await settle();
    assert.equal(computes, 1);

    // Within 1s backoff — must not start another refresh
    advance(500);
    assert.equal(await cache.getOrSet("k", failing), "v1");
    await settle();
    assert.equal(computes, 1);

    // Past first backoff (1s) — retry
    advance(600);
    assert.equal(await cache.getOrSet("k", failing), "v1");
    await settle();
    assert.equal(computes, 2);

    // Second failure backs off 2s
    advance(1_000);
    assert.equal(await cache.getOrSet("k", failing), "v1");
    await settle();
    assert.equal(computes, 2);

    advance(1_100);
    assert.equal(await cache.getOrSet("k", failing), "v1");
    await settle();
    assert.equal(computes, 3);
  });

  it("hard-evicts when staleAge exceeds maxStaleMs and clears refresh failure state", async () => {
    const cache = new LRUCache<string>(10, 1_000, {
      staleWhileRevalidate: true,
      maxStaleMs: 5_000,
    });

    await cache.getOrSet("k", async () => "v1");
    advance(1_001);

    assert.equal(
      await cache.getOrSet("k", async () => {
        throw new Error("boom");
      }),
      "v1",
    );
    await settle();

    // Drive into a long backoff so a boundary hit won't start a refresh.
    // failures=1 → 1s; fire another after 1s → failures=2 → 2s backoff.
    advance(1_100);
    assert.equal(
      await cache.getOrSet("k", async () => {
        throw new Error("boom2");
      }),
      "v1",
    );
    await settle();

    // staleAge === maxStaleMs → still serve stale (evict only when > maxStaleMs).
    // Currently ~1001+1100 after first expiry start; nudge to exact boundary.
    // expiresAt = t0+1000. Want now = expiresAt + 5000 = t0+6000.
    // now is t0+1001+1100 = t0+2101 → advance 3899 → t0+6000, staleAge=5000.
    advance(3_899);
    assert.equal(
      await cache.getOrSet("k", async () => {
        throw new Error("must-not-run-at-boundary");
      }),
      "v1",
    );
    await settle();

    // One more ms → hard eviction; caller waits on fresh compute
    advance(1);
    let coldComputes = 0;
    assert.equal(
      await cache.getOrSet("k", async () => {
        coldComputes++;
        return "v-fresh";
      }),
      "v-fresh",
    );
    assert.equal(coldComputes, 1);

    // Eviction cleared failure state — next expiry can refresh immediately
    advance(1_001);
    let afterEvict = 0;
    let resolveRefresh!: (v: string) => void;
    assert.equal(
      await cache.getOrSet("k", () => {
        afterEvict++;
        return new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        });
      }),
      "v-fresh",
    );
    assert.equal(afterEvict, 1);
    resolveRefresh("v3");
    await settle();
  });
});
