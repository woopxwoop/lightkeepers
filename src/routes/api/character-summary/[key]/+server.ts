/**
 * GET /api/character-summary/[key]
 *
 * Proxies `sim/characters/{GoodKey}.json.gz` (same CDN path as character page SSR).
 */
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getCharacterSummary } from "#lib/server/character-summary.js";
import {
  PUBLIC_CDN_CACHE_HEADERS,
  loadFromCdn,
} from "#lib/server/cdn-proxy.js";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";

export const GET: RequestHandler = async ({
  params,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const key = params.key?.trim();
  if (!key) error(400, "Missing character key");

  const summary = await loadFromCdn({
    route: `/api/character-summary/${JSON.stringify(key)}`,
    what: "character summary",
    load: () => getCharacterSummary(key),
  });
  if (!summary) error(404, `No Builds summary for ${key}`);

  return Response.json(summary, { headers: PUBLIC_CDN_CACHE_HEADERS });
};
