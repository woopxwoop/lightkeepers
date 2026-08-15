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

import { json, error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getInvestmentFile } from "$lib/server/team-config";

export const GET: RequestHandler = async () => {
  try {
    const payload = await getInvestmentFile();
    return json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    if (isHttpError(err)) throw err;
    console.error("/api/investment:", err);
    throw error(502, "Failed to fetch investment data from CDN");
  }
};
