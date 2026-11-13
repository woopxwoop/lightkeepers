/**
 * GET /api/investment
 *
 * Proxies the gcsim investment.json.gz from R2 so the browser doesn't
 * need to deal with cross-origin CORS restrictions.
 *
 * Cache strategy:
 *   s-maxage=300      — Cloudflare caches for 5 minutes at the edge
 *   stale-while-revalidate=60 — serve stale while refreshing
 *
 * Server L1 + Valkey live in getInvestmentFile() (shared with team-config SSR).
 */
import type { RequestHandler } from "./$types";
import {
  PUBLIC_CDN_CACHE_HEADERS,
  loadFromCdn,
} from "#lib/server/cdn-proxy.js";
import { getInvestmentFile } from "#lib/server/team-config.js";

export const GET: RequestHandler = async () => {
  const payload = await loadFromCdn({
    route: "/api/investment",
    what: "investment data",
    load: getInvestmentFile,
  });
  return Response.json(payload, { headers: PUBLIC_CDN_CACHE_HEADERS });
};
