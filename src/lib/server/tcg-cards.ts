/**
 * Server fetch for TCG card availability manifest.
 * Source: `characters/tcg-cards.json` on the asset CDN.
 */
import { LRUCache } from "#lib/server/cache.js";
import { fetchWithTimeout } from "#lib/cdn-fetch.js";
import {
  mergeTcgCardNameIds,
  tcgCardsPayloadFromCdn,
  type TcgCardsFile,
} from "#lib/tcg-cards.js";

const CDN_TCG_CARDS = "https://api.lightkeepers.moe/characters/tcg-cards.json";

export type TcgCardsPayload = TcgCardsFile & {
  /**
   * True when the CDN manifest is missing or malformed — only manuals are
   * known; clients should still probe other characters until a real list exists.
   */
  provisional?: boolean;
};

const cache = new LRUCache<TcgCardsPayload>(1, 15 * 60 * 1000, {
  redisNamespace: "tcg-cards",
});

async function fetchTcgCardsFile(): Promise<TcgCardsPayload> {
  const res = await fetchWithTimeout(CDN_TCG_CARDS);
  if (res.status === 404 || res.status === 410) {
    return { name_ids: mergeTcgCardNameIds([]), provisional: true };
  }
  if (!res.ok) throw new Error(`tcg-cards CDN HTTP ${res.status}`);
  return tcgCardsPayloadFromCdn(await res.json());
}

export async function getTcgCardsFile(): Promise<TcgCardsPayload> {
  return cache.getOrSet("tcg-cards", fetchTcgCardsFile);
}
