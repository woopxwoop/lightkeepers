import { supabase as db } from "./lib/supabase.js";
import "dotenv/config";

const BASE_STYGIAN_ID = 5269001;
const LUNARIS_VERSION_ROUTE = "https://api.lunaris.moe/data/version.json";
const BASE_LUNARIS_STYGIAN_ROUTE = "https://lunaris.moe/data/leylinechallenge";

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

async function getStygianInfo(
  versionOffset: number,
): Promise<StygianInfo | undefined> {
  const url = `${BASE_LUNARIS_STYGIAN_ROUTE}/${BASE_STYGIAN_ID + versionOffset}.json`;
  const response = await fetch(url);
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`getStygianInfo: HTTP ${response.status} fetching ${url}`);
  }
  return (await response.json()) as StygianInfo;
}

async function fillStygianEnemyInfo(numVersionsLimit: number): Promise<void> {
  const { data: versions, error } = await db
    .from("stygian_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(numVersionsLimit);

  if (error) throw error;
  if (!versions || versions.length === 0) return;

  for (const version of versions) {
    const info = await getStygianInfo(version.version_number + 1);
    if (info === undefined) {
      console.log(`  version ${version.version_number}: no Lunaris data yet, skipping`);
      continue;
    }

    const FEARLESS_LEVEL = 4;
    const levelConfigs = info.levels[FEARLESS_LEVEL]?.levelConfigs;
    if (!Array.isArray(levelConfigs) || levelConfigs.length < 3) continue;

    // Upsert the three enemies
    for (const enemy of levelConfigs) {
      const { error: enemyErr } = await db.from("enemies").upsert({
        id: enemy.id,
        enemy_name: enemy.enLevelName,
        asset: enemy.specialMonsterIcon,
        description: enemy.description ?? null,
      });
      if (enemyErr) throw enemyErr;
    }

    // Upsert the version → enemy join rows (slot_index 0, 1, 2)
    const versionEnemyRows = levelConfigs.slice(0, 3).map((enemy, i) => ({
      version_number: version.version_number,
      enemy_id: enemy.id,
      slot_index: i,
    }));

    const { error: joinErr } = await db
      .from("stygian_version_enemies")
      .upsert(versionEnemyRows, { onConflict: "version_number,slot_index" });
    if (joinErr) throw joinErr;

    console.log(`  version ${version.version_number}: enemies upserted`);
  }
}

await fillStygianEnemyInfo(1);
