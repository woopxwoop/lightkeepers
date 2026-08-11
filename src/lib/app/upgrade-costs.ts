/**
 * Lazy client loader for upgrade-cost JSON (calculator route only).
 * Goes through `/api/upgrade-costs` (same-origin) — CDN has no browser CORS.
 */
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
    const res = await fetch(API_URL);
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
