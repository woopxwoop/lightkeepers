/**
 * GET /api/character-summary/[key]
 *
 * Proxies `sim/characters/{GoodKey}.json.gz` (same CDN path as character page SSR).
 */
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getCharacterSummary } from "$lib/server/character-summary";
import { enforceApiRateLimit } from "$lib/server/rate-limit";

export const GET: RequestHandler = async ({
  params,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const key = params.key?.trim();
  if (!key) throw error(400, "Missing character key");

  const summary = await getCharacterSummary(key);
  if (!summary) throw error(404, `No Builds summary for ${key}`);

  return json(summary, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
