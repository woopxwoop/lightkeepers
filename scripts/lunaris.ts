import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database.types.js";
import "dotenv/config";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("PUBLIC_SUPABASE_URL and PRIVATE_SUPABASE_KEY must be set");
}

const db = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

const BASE_STYGIAN_ID = 5269001;
const LUNARIS_VERSION_ROUTE = "https://api.lunaris.moe/data/version.json";
const BASE_LUNARIS_STYGIAN_ROUTE = "https://lunaris.moe/data/leylinechallenge";

interface LevelConfig {
  id: number;
  specialMonsterIcon: string;
  enLevelName: string;
}

interface StygianInfo {
  scheduleId: number;
  levels: { levelConfigs: LevelConfig[] }[];
}

async function getVersion(): Promise<string | undefined> {
  try {
    const response = await fetch(LUNARIS_VERSION_ROUTE);
    if (!response.ok) return undefined;
    const data = (await response.json()) as { version: string };
    return data.version;
  } catch (error) {
    console.error("Network error:", error);
    return undefined;
  }
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
  const { data: fill, error } = await db
    .from("stygian_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(numVersionsLimit);

  if (error) throw error;
  if (!fill || fill.length === 0) return;

  // Use for...of so each upsert is properly awaited
  for (const version of fill) {
    const info = await getStygianInfo(version.version_number + 1);
    if (info === undefined) {
      console.log(`  version ${version.version_number}: no Lunaris data yet, skipping`);
      continue;
    }

    const FEARLESS_LEVEL = 4;
    const levelConfigs = info.levels[FEARLESS_LEVEL]?.levelConfigs;
    if (!Array.isArray(levelConfigs) || levelConfigs.length < 3) continue;

    for (const enemy of levelConfigs) {
      const { error } = await db.from("enemies").upsert({
        id: enemy.id,
        lunaris_asset: enemy.specialMonsterIcon,
        name: enemy.enLevelName,
      });
      if (error) throw error;
    }

    const { error } = await db
      .from("stygian_versions")
      .update({
        schedule_id: info!.scheduleId,
        enemy_id_1: levelConfigs[0].id,
        enemy_id_2: levelConfigs[1].id,
        enemy_id_3: levelConfigs[2].id,
      })
      .eq("version_number", version.version_number);
    if (error) throw error;
  }
}

await fillStygianEnemyInfo(1);
