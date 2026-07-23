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

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { LRUCache } from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { e2eStaticPayload } from "$lib/e2e/fixtures";
import type { Tables } from "$lib/types/database.types";
import type {
  StygianEnemies,
  AbyssChamberEnemy,
  AbyssEnemies,
  StygianSchedule,
} from "$lib/definitions";

type Version = Tables<"abyss_versions">;
type StygianVersion = Tables<"stygian_versions">;
type Enemy = Tables<"enemies">;

type StaticPayload = {
  latestAbyssVersion: Version;
  latestStygianVersion: StygianVersion;
  allTeamsAbyss: unknown[];
  allTeamsStygian: unknown[];
  stygianEnemies: StygianEnemies;
  abyssEnemies: AbyssEnemies;
  stygianSchedule: StygianSchedule;
};

// Single-entry cache — we only ever need the most recent fetch.
// Valkey L2 when VALKEY_URL is set so pm2 workers share cold SSR hits.
const staticCache = new LRUCache<StaticPayload>(1, 15 * 60 * 1000, {
  redisNamespace: "static",
  staleWhileRevalidate: true,
});
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

  // Transient query failures must not become version_number: -1 — that yields
  // empty team payloads which getOrSet would cache in L1/L2.
  if (abyssVerRes.error) {
    console.error("fetchStaticData: abyss_versions error", abyssVerRes.error);
    throw error(500, "Failed to fetch Abyss version");
  }
  if (stygianVerRes.error) {
    console.error(
      "fetchStaticData: stygian_versions error",
      stygianVerRes.error,
    );
    throw error(500, "Failed to fetch Stygian version");
  }

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
  const [abyssTeamsRes, stygianTeamsRes, versionEnemiesRes, abyssScheduleRes, stygianScheduleRes] =
    await Promise.all([
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
      serverDb
        .from("lunaris_abyss_versions")
        .select("floors, buff_name, open_time")
        .eq("ys_abyss_version", latestAbyssVersion.version_number)
        .maybeSingle(),
      serverDb
        .from("lunaris_stygian_versions")
        .select("schedule_id, open_time, close_time, challenge_name")
        .eq("ys_stygian_version", latestStygianVersion.version_number)
        .maybeSingle(),
    ]);

  if (abyssTeamsRes.error) {
    console.error("fetchStaticData: abyss RPC error", abyssTeamsRes.error);
    throw error(500, "Failed to fetch Abyss team data");
  }
  if (stygianTeamsRes.error) {
    console.error("fetchStaticData: stygian RPC error", stygianTeamsRes.error);
    throw error(500, "Failed to fetch Stygian team data");
  }
  if (versionEnemiesRes.error) {
    console.error("fetchStaticData: stygian_version_enemies error", versionEnemiesRes.error);
    throw error(500, "Failed to fetch Stygian version enemies");
  }
  if (abyssScheduleRes.error) {
    console.error("fetchStaticData: lunaris_abyss_versions error", abyssScheduleRes.error);
    throw error(500, "Failed to fetch Abyss schedule data");
  }
  if (stygianScheduleRes.error) {
    console.error("fetchStaticData: lunaris_stygian_versions error", stygianScheduleRes.error);
    throw error(500, "Failed to fetch Stygian schedule data");
  }

  const versionEnemyRows = versionEnemiesRes.data;
  const enemyIds = versionEnemyRows
    .map((r) => r.enemy_id)
    .filter((id): id is number => id !== null);

  const enemiesRes =
    enemyIds.length > 0
      ? await serverDb.from("enemies").select("*").in("id", enemyIds)
      : { data: [], error: null };

  if (enemiesRes.error) {
    console.error("fetchStaticData: enemies query error", enemiesRes.error);
    throw error(500, "Failed to fetch enemy data");
  }

  const enemyMap = new Map(
    enemiesRes.data.map((e: Enemy) => [e.id, e]),
  );

  // slot_index: 0=top, 1=middle, 2=bottom
  const slotRow = (idx: number) =>
    versionEnemyRows.find((r) => r.slot_index === idx);

  const stygianEnemies: StygianEnemies = {
    top: enemyMap.get(slotRow(0)?.enemy_id ?? -1) ?? null,
    middle: enemyMap.get(slotRow(1)?.enemy_id ?? -1) ?? null,
    bottom: enemyMap.get(slotRow(2)?.enemy_id ?? -1) ?? null,
  };

  // ── Parse abyss floors (floor 12) ───────────────────────────────────────
  // floors JSONB follows AbyssFloorRecord[] from hybrid sync
  // (scripts/sync/abyss-schedules.ts → $lib/types/schedules)
  type ParsedMonster = { id: number; name: string; icon: string };
  type FloorRecord = {
    floorId: number;
    floorIndex: number;
    chambers: {
      monsterLevel: number;
      firstHalfMonsters: ParsedMonster[];
      secondHalfMonsters: ParsedMonster[];
    }[];
  };

  const scheduleRow = abyssScheduleRes.data as {
    buff_name?: string | null;
    open_time?: string | null;
  } | null;
  const buffName: string | null = scheduleRow?.buff_name ?? null;
  const openTime: string | null = scheduleRow?.open_time ?? null;

  const emptyAbyssEnemies: AbyssEnemies = { top: [], bottom: [], buffName, openTime };
  let abyssEnemies: AbyssEnemies = emptyAbyssEnemies;

  if (abyssScheduleRes.data?.floors) {
    try {
      const floors = abyssScheduleRes.data.floors as unknown as FloorRecord[];
      const floor12 = floors.find((f) => f.floorIndex === 12);

      if (floor12) {
        // Collect enemy IDs not yet in the Stygian enemy map
        const abyssEnemyIds = new Set<number>();
        for (const chamber of floor12.chambers) {
          for (const mon of [
            ...chamber.firstHalfMonsters,
            ...chamber.secondHalfMonsters,
          ]) {
            abyssEnemyIds.add(mon.id);
          }
        }

        const missingIds = [...abyssEnemyIds].filter((id) => !enemyMap.has(id));
        if (missingIds.length > 0) {
          const abyssEnemiesRes = await serverDb
            .from("enemies")
            .select("*")
            .in("id", missingIds);
          if (abyssEnemiesRes.error) {
            console.error(
              "fetchStaticData: abyss enemies query error",
              abyssEnemiesRes.error,
            );
          } else {
            for (const e of abyssEnemiesRes.data) {
              enemyMap.set(e.id, e as Enemy);
            }
          }
        }

        const toEnemy = (mon: ParsedMonster): AbyssChamberEnemy => {
          const enemy = enemyMap.get(mon.id);
          return {
            id: mon.id,
            name: mon.name,
            asset: enemy?.asset ?? mon.icon ?? null,
          };
        };

        abyssEnemies = {
          top: floor12.chambers.map((chamber, i) => ({
            chamber: i + 1,
            monsterLevel: chamber.monsterLevel,
            enemies: chamber.firstHalfMonsters.map(toEnemy),
          })),
          bottom: floor12.chambers.map((chamber, i) => ({
            chamber: i + 1,
            monsterLevel: chamber.monsterLevel,
            enemies: chamber.secondHalfMonsters.map(toEnemy),
          })),
          buffName,
          openTime,
        };
      }
    } catch (err) {
      console.error("fetchStaticData: malformed abyss floors JSONB", err);
      abyssEnemies = emptyAbyssEnemies;
    }
  }

  // ── Build Stygian schedule object ──────────────────────────────────────
  const stygianScheduleRow = stygianScheduleRes.data as {
    schedule_id?: number;
    open_time?: string | null;
    close_time?: string | null;
    challenge_name?: string | null;
  } | null;

  const stygianSchedule: StygianSchedule = stygianScheduleRow
    ? {
        scheduleId: stygianScheduleRow.schedule_id ?? 0,
        openTime: stygianScheduleRow.open_time ?? null,
        closeTime: stygianScheduleRow.close_time ?? null,
        challengeName: stygianScheduleRow.challenge_name ?? null,
      }
    : null;

  return {
    latestAbyssVersion,
    latestStygianVersion,
    allTeamsAbyss: abyssTeamsRes.data,
    allTeamsStygian: stygianTeamsRes.data,
    stygianEnemies,
    abyssEnemies,
    stygianSchedule,
  };
}

export const GET: RequestHandler = async () => {
  if (isPlaywrightE2e()) {
    return json(e2eStaticPayload(), {
      headers: {
        "Cache-Control": "no-store",
        "X-Playwright-E2E": "1",
      },
    });
  }

  const payload = await staticCache.getOrSet(CACHE_KEY, fetchStaticData);

  return json(payload, {
    headers: {
      // Cloudflare will cache this response for 5 minutes,
      // serving stale for an extra 60s while it revalidates.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
