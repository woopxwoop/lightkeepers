/**
 * Lazy client loader for upgrade-cost JSON (planner route only).
 * Goes through `/api/upgrade-costs` (same-origin) — CDN has no browser CORS.
 */
import { CDN_FETCH_TIMEOUT_MS } from "$lib/cdn-fetch";
import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";

const API_URL = "/api/upgrade-costs";

let cached: UpgradeCostsCatalog | null = null;
let pending: Promise<UpgradeCostsCatalog> | null = null;

export function getUpgradeCostsCached(): UpgradeCostsCatalog | null {
  return cached;
}

export function loadUpgradeCosts(): Promise<UpgradeCostsCatalog> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  pending = (async () => {
    const res = await fetch(API_URL, {
      signal: AbortSignal.timeout(CDN_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as UpgradeCostsCatalog;
    cached = data;
    return data;
  })().finally(() => {
    pending = null;
  });

  return pending;
}

export function prefetchUpgradeCosts(): void {
  loadUpgradeCosts().catch(() => {
    /* page retries on demand */
  });
}
