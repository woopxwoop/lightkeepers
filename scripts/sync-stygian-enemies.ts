/**
 * Sync Stygian Onslaught enemy info from Lunaris into local tables.
 *
 * Fetches the latest N stygian versions, pulls enemy data from Lunaris,
 * then upserts into `enemies` and `stygian_version_enemies`.
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/sync-stygian-enemies.ts [N]
 *
 *   N  — number of recent versions to sync (default: 1)
 */

import { supabase as db } from "./lib/supabase.js";
import type { Database } from "../src/lib/types/database.types.js";
import "dotenv/config";

type EnemyInsert = Database["public"]["Tables"]["enemies"]["Insert"];

const BASE_STYGIAN_ID    = 5269001;
const LUNARIS_STYGIAN    = "https://lunaris.moe/data/leylinechallenge";

interface LevelConfig {
  id: number;
  specialMonsterIcon: string;
  enLevelName: string;
  description?: string;
}

interface StygianInfo {
  scheduleId: number;
  levels: { levelConfigs: LevelConfig[] }[];
}

async function getStygianInfo(versionOffset: number): Promise<StygianInfo | undefined> {
  const url = `${LUNARIS_STYGIAN}/${BASE_STYGIAN_ID + versionOffset}.json`;
  const response = await fetch(url);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return (await response.json()) as StygianInfo;
}

async function sync(count: number) {
  const { data: versions, error } = await db
    .from("stygian_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(count);

  if (error) throw error;
  if (!versions || versions.length === 0) {
    console.log("No stygian versions found in DB.");
    return;
  }

  for (const version of versions) {
    const info = await getStygianInfo(version.version_number + 1);
    if (!info) {
      console.log(`  v${version.version_number}: no Lunaris data yet, skipping`);
      continue;
    }

    const FEARLESS_LEVEL = 4;
    const levelConfigs = info.levels[FEARLESS_LEVEL]?.levelConfigs;
    if (!Array.isArray(levelConfigs) || levelConfigs.length < 3) continue;

    // Upsert the three enemies
    for (const enemy of levelConfigs) {
      const row: EnemyInsert = {
        id: enemy.id,
        enemy_name: enemy.enLevelName,
        asset: enemy.specialMonsterIcon,
        icon_path: "leyline",
        description: enemy.description ?? null,
      };
      const { error: enemyErr } = await db.from("enemies").upsert(row);
      if (enemyErr) throw enemyErr;
    }

    // Upsert version → enemy join rows (slot_index 0, 1, 2)
    const rows = levelConfigs.slice(0, 3).map((enemy, i) => ({
      version_number: version.version_number,
      enemy_id: enemy.id,
      slot_index: i,
    }));

    const { error: joinErr } = await db
      .from("stygian_version_enemies")
      .upsert(rows, { onConflict: "version_number,slot_index" });
    if (joinErr) throw joinErr;

    console.log(`  v${version.version_number}: 3 enemies upserted`);
  }

  console.log("Done.");
}

const count = Math.max(1, parseInt(process.argv[2] ?? "1", 10));
console.log(`=== Stygian enemy sync (latest ${count}) ===`);
sync(count).catch(console.error);
