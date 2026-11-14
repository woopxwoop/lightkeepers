/**
 * GET /api/character-index
 *
 * Proxies `sim/characters.json.gz` (aggregate Builds summaries) so account
 * surfaces can grade many characters without N× `/api/character-summary/[key]`.
 *
 * Cache: CF s-maxage=300 + server L1/Valkey in getCharacterIndexFile().
 * No per-IP rate limit — same class as `/api/investment`.
 */
import type { RequestHandler } from "./$types";
import {
  PUBLIC_CDN_CACHE_HEADERS,
  loadFromCdn,
} from "#lib/server/cdn-proxy.js";
import { getCharacterIndexFile } from "#lib/server/character-summary.js";

export const GET: RequestHandler = async () => {
  const payload = await loadFromCdn({
    route: "/api/character-index",
    what: "character index",
    load: getCharacterIndexFile,
  });
  return Response.json(payload, { headers: PUBLIC_CDN_CACHE_HEADERS });
};
