/**
 * GET /api/tierlist
 *
 * Stygian cream-of-the-crop from `character_usage_avg_stygian`, split into
 * limited 5★ and non-limited (4★ + standard 5★) boards. Cutoff via relative
 * largest gap (ranks 8–16 limited / 24–32 non-limited). Also returns
 * `usageByNameId` for every catalog character with positive avg usage.
 * Independent of roster — cache hard like /api/static.
 */

import type { RequestHandler } from "./$types";
import { serverDb } from "#lib/server/supabaseServer.js";
import { LRUCache } from "#lib/server/cache.js";
import { loadCharacters } from "#lib/server/characters.js";
import { assertNoDbError } from "#lib/server/validation/core.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import { e2eTierListPayload } from "#lib/e2e/fixtures.js";
import {
  computeTierList,
  usageRowsFromView,
  type TierListPayload,
} from "#lib/boards/tierlist.js";

const tierListCache = new LRUCache<TierListPayload>(1, 15 * 60 * 1000, {
  redisNamespace: "tierlist",
  staleWhileRevalidate: true,
});
const CACHE_KEY = "tierlist-cream-v3";

async function fetchTierList(): Promise<TierListPayload> {
  const [usageRes, characters] = await Promise.all([
    serverDb
      .from("character_usage_avg_stygian")
      .select("character_id, avg_usage_rate, cycles"),
    loadCharacters(),
  ]);

  assertNoDbError("tierlist character_usage_avg_stygian", usageRes.error);

  return computeTierList(usageRowsFromView(usageRes.data), characters);
}

export const GET: RequestHandler = async () => {
  if (isPlaywrightE2e()) {
    return Response.json(e2eTierListPayload(), {
      headers: {
        "Cache-Control": "no-store",
        "X-Playwright-E2E": "1",
      },
    });
  }

  const payload = await tierListCache.getOrSet(CACHE_KEY, fetchTierList);

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
