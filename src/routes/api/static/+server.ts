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

type Version = Tables<"abyss_versions">;
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
      .from("abyss_versions")
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
    created_at: "",
    version_name: null,
    version_number: -1,
  };

  const latestStygianVersion: StygianVersion = stygianVerRes.data?.[0] ?? {
    created_at: "",
    version_name: null,
    version_number: -1,
  };

  // Fetch all teams + version enemies in parallel
  const [abyssTeamsRes, stygianTeamsRes, versionEnemiesRes] = await Promise.all([
    serverDb.rpc("get_teams_with_characters_subset", {
      p_name_ids: [],
      p_version_number: latestAbyssVersion.version_number,
    }),
    serverDb.rpc("get_teams_with_characters_subset_stygian", {
      p_name_ids: [],
      p_version_number: latestStygianVersion.version_number,
    }),
    serverDb
      .from("stygian_version_enemies")
      .select("slot_index, enemy_id")
      .eq("version_number", latestStygianVersion.version_number),
  ]);

  const versionEnemyRows = versionEnemiesRes.data ?? [];
  const enemyIds = versionEnemyRows
    .map((r) => r.enemy_id)
    .filter((id): id is number => id !== null);

  const enemiesRes =
    enemyIds.length > 0
      ? await serverDb.from("enemies").select("*").in("id", enemyIds)
      : { data: [] };

  const enemyMap = new Map(
    (enemiesRes.data ?? []).map((e: Enemy) => [e.id, e]),
  );

  // slot_index: 0=top, 1=middle, 2=bottom
  const slotRow = (idx: number) =>
    versionEnemyRows.find((r) => r.slot_index === idx);

  const stygianEnemies: StygianEnemies = {
    top: enemyMap.get(slotRow(0)?.enemy_id ?? -1) ?? null,
    middle: enemyMap.get(slotRow(1)?.enemy_id ?? -1) ?? null,
    bottom: enemyMap.get(slotRow(2)?.enemy_id ?? -1) ?? null,
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
