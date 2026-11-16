/**
 * Stygian tier list (roster-independent).
 *
 * Stygian tier list: ensureTierList() → GET /api/tierlist
 */

import { writable, get } from "svelte/store";
import type { TierListPayload } from "#lib/definitions.js";

// ── Stygian tier list (roster-independent) ─────────────────────────────────
export const tierList = writable<TierListPayload | null>(null);
export const tierListLoaded = writable(false);
export const tierListError = writable<string | null>(null);

let tierListInFlight: Promise<void> | null = null;
let tierListRequestId = 0;

export function invalidateTierList(): void {
  tierListRequestId++;
  tierListInFlight = null;
  tierListLoaded.set(false);
  tierListError.set(null);
  tierList.set(null);
}

export async function ensureTierList(): Promise<void> {
  if (get(tierListLoaded)) return;
  if (tierListInFlight) return tierListInFlight;

  const id = ++tierListRequestId;
  tierListError.set(null);

  const pending = (async () => {
    try {
      const res = await fetch("/api/tierlist");
      if (!res.ok) throw new Error(`tierlist fetch failed: ${res.status}`);
      const data = (await res.json()) as TierListPayload;
      if (id !== tierListRequestId) return;
      tierList.set(data);
      tierListError.set(null);
      tierListLoaded.set(true);
    } catch (err) {
      if (id !== tierListRequestId) return;
      const message =
        err instanceof Error ? err.message : "Failed to load tier list";
      tierListError.set(message);
      console.error("[stores] ensureTierList failed:", err);
      throw err;
    }
  })();

  tierListInFlight = pending;
  void pending
    .finally(() => {
      if (tierListInFlight === pending) tierListInFlight = null;
    })
    .catch(() => {});
  return pending;
}
