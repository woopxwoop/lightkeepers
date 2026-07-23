/**
 * POST /api/nearmiss
 *
 * Returns near-miss Stygian teams for pull suggestions:
 *   - nearMissTeams   (one missing character)
 *   - nearMissPairs   (two missing characters, filtered by PMI)
 *
 * Body: { characters: string[]; stygianVersion: number; minPmi?: number }
 *
 * Cache: in-memory LRU keyed by sorted character list + version.
 * Rate limit: shared 60 req/min/IP limiter from cache.ts.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import {
  rpcCache,
  apiRateLimiter,
  getClientIp,
  buildRpcKey,
} from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";

type NearMissBody = {
  characters: string[];
  stygianVersion: number;
  minPmi?: number;
};

export const POST: RequestHandler = async ({ request }) => {
  // Default empty; Playwright browser routes override with scenario fixtures.
  if (isPlaywrightE2e()) {
    return json({ nearMissTeams: [], nearMissPairs: [] });
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  if (!apiRateLimiter.check(ip)) {
    throw error(429, "Too many requests — please wait a moment.");
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: NearMissBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body.");
  }

  const { characters, stygianVersion, minPmi = 0.3 } = body;

  if (!Array.isArray(characters)) {
    throw error(400, "characters must be an array of strings.");
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const singleKey = buildRpcKey("near_miss_single", stygianVersion, characters);
  const pairKey = buildRpcKey(
    `near_miss_pair_pmi${minPmi}`,
    stygianVersion,
    characters,
  );

  let nearMissTeams: unknown, nearMissPairs: unknown;
  try {
    [nearMissTeams, nearMissPairs] = await Promise.all([
      rpcCache.getOrSet(singleKey, async () => {
        const { data, error: err } = await serverDb.rpc(
          "get_near_miss_stygian_teams",
          {
            p_name_ids: characters,
            p_version_number: stygianVersion,
          },
        );
        if (err) {
          console.error("[nearmiss] get_near_miss_stygian_teams error:", err);
          throw new Error(err.message);
        }
        return data ?? [];
      }),

      rpcCache.getOrSet(pairKey, async () => {
        const { data, error: err } = await serverDb.rpc(
          "get_near_miss_stygian_pairs",
          {
            p_name_ids: characters,
            p_version_number: stygianVersion,
            p_min_pmi: minPmi,
          },
        );
        if (err) {
          console.error("[nearmiss] get_near_miss_stygian_pairs error:", err);
          throw new Error(err.message);
        }
        return data ?? [];
      }),
    ]);
  } catch (e) {
    console.error("[nearmiss] RPC failed:", e);
    throw error(500, "Internal server error");
  }

  return json({ nearMissTeams, nearMissPairs });
};
