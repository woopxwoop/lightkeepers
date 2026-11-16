/**
 * GET /api/character-kit/[nameId]
 *
 * Proxies CDN character kit JSON (live, then beta). Browser cannot fetch the
 * CDN kit directly (no CORS); SSR uses `#lib/server/character-kit.js` instead.
 */
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getCharacterKit } from "#lib/server/character-kit.js";
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
  const nameId = params.nameId?.trim();
  if (!nameId) error(400, "Missing character name_id");

  const kit = await loadFromCdn({
    route: `/api/character-kit/${JSON.stringify(nameId)}`,
    what: "character kit",
    load: () => getCharacterKit(nameId),
  });
  if (!kit) error(404, `No kit for ${nameId}`);

  return Response.json(kit, { headers: PUBLIC_CDN_CACHE_HEADERS });
};
