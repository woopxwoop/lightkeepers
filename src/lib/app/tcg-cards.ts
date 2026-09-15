/**
 * Client loader for TCG card availability (`/api/tcg-cards`).
 * CharacterIcon uses this to skip probing missing `card.webp` URLs.
 */
import { writable } from "svelte/store";
import { CDN_FETCH_TIMEOUT_MS } from "$lib/cdn-fetch";
import {
  parseTcgCardsFile,
  stemHasTcgCard,
  type TcgCardsFile,
} from "$lib/tcg-cards";
import { uiAssetNameId } from "$lib/utils";

/** Bumped after index load/failure so icons re-derive. */
export const tcgCardIndexVersion = writable(0);

let cached: ReadonlySet<string> | null = null;
let provisional = false;
let pending: Promise<ReadonlySet<string>> | null = null;
/** True after a successful or soft-failed load. */
let settled = false;

export function getTcgCardIdsCached(): ReadonlySet<string> | null {
  return cached;
}

/**
 * `true` / `false` once the full index is known; `null` while unknown or
 * provisional (manifest not published — may still probe + onerror).
 * Manual Traveler (`PlayerBoy`) is `true` as soon as the soft index loads.
 */
export function hasTcgCard(nameId: string | null | undefined): boolean | null {
  if (!settled || cached === null) return null;
  if (!nameId) return false;
  const stem = uiAssetNameId(nameId);
  if (stemHasTcgCard(cached, stem)) return true;
  if (provisional) return null;
  return false;
}

export function loadTcgCardIds(): Promise<ReadonlySet<string>> {
  if (cached && settled) return Promise.resolve(cached);
  if (pending) return pending;

  pending = (async () => {
    try {
      const res = await fetch("/api/tcg-cards", {
        signal: AbortSignal.timeout(CDN_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as TcgCardsFile & {
        provisional?: boolean;
      };
      const data = parseTcgCardsFile(raw);
      cached = new Set(data.name_ids);
      provisional = Boolean(raw.provisional);
    } catch {
      // Network failure: manuals only, keep probing everyone else.
      const data = parseTcgCardsFile({ name_ids: [] });
      cached = new Set(data.name_ids);
      provisional = true;
    } finally {
      settled = true;
      pending = null;
      tcgCardIndexVersion.update((n) => n + 1);
    }
    return cached!;
  })();

  return pending;
}
