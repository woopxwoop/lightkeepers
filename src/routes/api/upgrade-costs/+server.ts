/**
 * GET /api/upgrade-costs
 *
 * Proxies upgrade-cost JSON from R2 so the browser isn't blocked by CDN CORS
 * (same pattern as `/api/investment`). Live + beta merge and caching live in
 * `getUpgradeCostsCatalog()`.
 */
import type { RequestHandler } from "./$types";
import {
  PUBLIC_CDN_CACHE_HEADERS,
  loadFromCdn,
} from "#lib/server/cdn-proxy.js";
import { getUpgradeCostsCatalog } from "#lib/server/upgrade-costs.js";

export const GET: RequestHandler = async () => {
  const payload = await loadFromCdn({
    route: "/api/upgrade-costs",
    what: "upgrade costs",
    load: getUpgradeCostsCatalog,
  });
  return Response.json(payload, { headers: PUBLIC_CDN_CACHE_HEADERS });
};
