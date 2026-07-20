/**
 * Shared client fetch for `/api/investment`.
 *
 * Both `/teams` and `/teams/[slug]` need the same payload — fetch once per
 * session and reuse the in-flight / resolved promise. Prefetched from
 * `bootstrapClient` so navigating to Teams is usually already warm.
 */

import type { InvestmentFile } from "$lib/types/investment";

const API_URL = "/api/investment";

let cached: InvestmentFile | null = null;
let pending: Promise<InvestmentFile> | null = null;

/** Resolved payload if already loaded; otherwise null. */
export function getInvestmentCached(): InvestmentFile | null {
  return cached;
}

/**
 * Load investment data (or return the in-flight / cached result).
 * Throws on HTTP / network failure — callers should catch.
 */
export function loadInvestment(): Promise<InvestmentFile> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  pending = (async () => {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as InvestmentFile;
    cached = data;
    return data;
  })().finally(() => {
    pending = null;
  });

  return pending;
}

/** Fire-and-forget warm-up — swallows errors (page will retry on demand). */
export function prefetchInvestment(): void {
  loadInvestment().catch(() => {
    /* ignore — next loadInvestment() will retry */
  });
}
