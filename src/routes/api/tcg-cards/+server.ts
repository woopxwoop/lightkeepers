/**
 * GET /api/tcg-cards
 *
 * Proxies `characters/tcg-cards.json` (name_ids with TCG card art).
 * Always includes manual Traveler (`PlayerBoy`). Same cache class as investment.
 */
import type { RequestHandler } from "./$types";
import {
  PUBLIC_CDN_CACHE_HEADERS,
  loadFromCdn,
} from "#lib/server/cdn-proxy.js";
import { getTcgCardsFile } from "#lib/server/tcg-cards.js";

export const GET: RequestHandler = async () => {
  const payload = await loadFromCdn({
    route: "/api/tcg-cards",
    what: "TCG card index",
    load: getTcgCardsFile,
  });
  return Response.json(payload, { headers: PUBLIC_CDN_CACHE_HEADERS });
};
