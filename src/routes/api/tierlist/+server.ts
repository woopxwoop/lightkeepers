/**
 * GET /api/tierlist
 *
 * Stygian cream-of-the-crop from `character_usage_avg_stygian`, split into
 * limited 5★ and non-limited (4★ + standard 5★) boards. Cutoff via relative
 * largest gap (ranks 8–16 limited / 24–32 non-limited). Also returns
 * `usageByNameId` for every catalog character with positive avg usage.
 * Independent of roster — cache hard like /api/static.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "#lib/server/supabaseServer.js";
import { LRUCache, charactersCache } from "#lib/server/cache.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import { e2eTierListPayload } from "#lib/e2e/fixtures.js";
import {
  computeTierList,
  type CharacterUsageRow,
  type TierListPayload,
} from "#lib/tierlist.js";
import type { Tables } from "#lib/types/database.types.js";

type Character = Tables<"characters">;

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
    charactersCache.getOrSet("characters", async () => {
      const { data, error: err } = await serverDb
        .from("characters")
        .select("*");
      if (err) {
        console.error("[tierlist] characters error:", err);
        throw new Error(err.message);
      }
      return (data ?? []) as Character[];
    }),
  ]);

  if (usageRes.error) {
    console.error(
      "[tierlist] character_usage_avg_stygian error:",
      usageRes.error,
    );
    throw error(500, "Failed to fetch character usage averages");
  }

  const usageRows: CharacterUsageRow[] = (usageRes.data ?? []).flatMap(
    (row) => {
      if (
        typeof row.character_id !== "number" ||
        typeof row.avg_usage_rate !== "number"
      ) {
        return [];
      }
      return [
        {
          character_id: row.character_id,
          avg_usage_rate: row.avg_usage_rate,
          cycles: typeof row.cycles === "number" ? row.cycles : 0,
        },
      ];
    },
  );

  return computeTierList(usageRows, characters);
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
