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
 * The server also keeps the result in a 15-minute in-process cache.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { LRUCache } from "$lib/server/cache";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { InvestmentFile } from "$lib/types/investment";

const gunzipAsync = promisify(gunzip);

const CDN_URL = "https://api.lightkeepers.moe/sim/investment.json.gz";

const cache = new LRUCache<InvestmentFile>(1, 15 * 60 * 1000);
const CACHE_KEY = "investment";

/** gzip magic bytes: 0x1F 0x8B */
function isGzipped(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

async function fetchInvestment(): Promise<InvestmentFile> {
  const res = await fetch(CDN_URL);
  if (!res.ok) throw error(502, `CDN returned HTTP ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());

  const raw = isGzipped(buf)
    ? (await gunzipAsync(buf)).toString("utf-8")
    : buf.toString("utf-8");
  return JSON.parse(raw);
}

export const GET: RequestHandler = async () => {
  try {
    const payload = await cache.getOrSet(CACHE_KEY, fetchInvestment);
    return json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("/api/investment:", err);
    throw error(502, "Failed to fetch investment data from CDN");
  }
};
