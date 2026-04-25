/**
 * GET /api/static
 *
 * Returns long lasting, high frequency data
 *   - latestAbyssVersion
 *   - latestStygianVersion
 *   - allTeamsAbyss
 *   - allTeamsStygian
 *
 * Cache strategy:
 *   s-maxage=300      — Cloudflare caches for 5 minutes at the edge
 *   stale-while-revalidate=60 — serve stale while refreshing in the background
 *
 * The server also keeps the result in a 15-minute in-process cache so that
 * even cache misses at the edge don't hammer Supabase.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { LRUCache } from "$lib/server/cache";
import type { Tables } from "$lib/types/database.types";

type Version = Tables<"versions">;
type StygianVersion = Tables<"stygian_versions">;
type Enemy = Tables<"enemies">;

type StygianEnemies = {
  top: Enemy | null;
  middle: Enemy | null;
  bottom: Enemy | null;
};

type StaticPayload = {
  latestAbyssVersion: Version;
  latestStygianVersion: StygianVersion;
  allTeamsAbyss: unknown[];
  allTeamsStygian: unknown[];
  stygianEnemies: StygianEnemies;
};

// Single-entry cache — we only ever need the most recent fetch.
const staticCache = new LRUCache<StaticPayload>(1, 15 * 60 * 1000);
const CACHE_KEY = "static";

async function fetchStaticData(): Promise<StaticPayload> {
  const [abyssVerRes, stygianVerRes] = await Promise.all([
    serverDb
      .from("versions")
      .select("*")
      .order("version_number", { ascending: false })
      .limit(1),
    serverDb
      .from("stygian_versions")
      .select("*")
      .order("version_number", { ascending: false })
      .limit(1),
  ]);

  const latestAbyssVersion: Version = abyssVerRes.data?.[0] ?? {
    version: "unknown",
    version_number: -1,
  };

  const latestStygianVersion: StygianVersion = stygianVerRes.data?.[0] ?? {
    version: "unknown",
    version_number: -1,
    schedule_id: null,
    enemy_id_1: null,
    enemy_id_2: null,
    enemy_id_3: null,
  };

  // Fetch all teams + ranked combinations in parallel
  const [abyssTeamsRes, stygianTeamsRes] = await Promise.all([
    serverDb.rpc("get_teams_with_characters_subset", {
      p_character_names: [],
      p_version_number: latestAbyssVersion.version_number,
    }),
    serverDb.rpc("get_teams_with_characters_subset_stygian", {
      p_character_names: [],
      p_version_number: latestStygianVersion.version_number,
    }),
  ]);

  const enemyIds = [
    latestStygianVersion.enemy_id_1,
    latestStygianVersion.enemy_id_2,
    latestStygianVersion.enemy_id_3,
  ].filter((id): id is number => id !== null);

  const enemiesRes =
    enemyIds.length > 0
      ? await serverDb.from("enemies").select("*").in("id", enemyIds)
      : { data: [] };

  const enemyMap = new Map(
    (enemiesRes.data ?? []).map((e: Enemy) => [e.id, e]),
  );

  const stygianEnemies: StygianEnemies = {
    top: enemyMap.get(latestStygianVersion.enemy_id_1 ?? -1) ?? null,
    middle: enemyMap.get(latestStygianVersion.enemy_id_2 ?? -1) ?? null,
    bottom: enemyMap.get(latestStygianVersion.enemy_id_3 ?? -1) ?? null,
  };

  return {
    latestAbyssVersion,
    latestStygianVersion,
    allTeamsAbyss: abyssTeamsRes.data ?? [],
    allTeamsStygian: stygianTeamsRes.data ?? [],
    stygianEnemies,
  };
}

export const GET: RequestHandler = async () => {
  const payload = await staticCache.getOrSet(CACHE_KEY, fetchStaticData);

  return json(payload, {
    headers: {
      // Cloudflare will cache this response for 5 minutes,
      // serving stale for an extra 60s while it revalidates.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
