/**
 * GET /api/character-kit/[nameId]
 *
 * Proxies CDN character kit JSON (live, then beta). Browser cannot fetch the
 * CDN kit directly (no CORS); SSR uses `$lib/server/character-kit` instead.
 */
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getCharacterKit } from "$lib/server/character-kit";
import { enforceApiRateLimit } from "$lib/server/rate-limit";

export const GET: RequestHandler = async ({
  params,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const nameId = params.nameId?.trim();
  if (!nameId) throw error(400, "Missing character name_id");

  let kit;
  try {
    kit = await getCharacterKit(nameId);
  } catch (err) {
    console.error(`/api/character-kit/${JSON.stringify(nameId)}:`, err);
    throw error(502, "Failed to fetch character kit from CDN");
  }
  if (!kit) throw error(404, `No kit for ${nameId}`);

  return json(kit, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
