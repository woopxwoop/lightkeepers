import { EnkaClient } from "enka-network-api";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_KEY;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_STYGIAN_ID = 5269001;
const LUNARIS_VERSION_ROUTE = "https://api.lunaris.moe/data/version.json";
const BASE_LUNARIS_STYGIAN_ROUTE = "https://lunaris.moe/data/leylinechallenge";

async function getVersion() {
  try {
    const response = await fetch(LUNARIS_VERSION_ROUTE);
    if (!response.ok) return;
    const data = await response.json();
    // console.log(data);
    return data.version;
  } catch (error) {
    console.error("Network error:", error);
  }
}

async function getStygianInfo(version_offset) {
  try {
    const response = await fetch(
      `${BASE_LUNARIS_STYGIAN_ROUTE}/${BASE_STYGIAN_ID + version_offset}.json`,
    );
    if (!response.ok) return;
    const data = await response.json();
    // console.log(data);
    return data;
  } catch (error) {
    console.error("Network error:", error);
  }
}

async function fillStygianEnemyInfo(num_versions_limit) {
  const { data: fill } = await db
    .from("stygian_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(num_versions_limit);

  fill.forEach(async (version) => {
    let info = await getStygianInfo(version.version_number + 1);

    const FEARLESS_LEVEL = 4;

    let levelConfigs = info?.levels[FEARLESS_LEVEL]?.levelConfigs;

    // ${config.monsterStats}, ${config.enLevelMaxDescription}
    // levelConfigs.forEach((config) => {
    //   console.log(
    //     `${config.id}: ${config.enLevelName}, ${config.specialMonsterIcon}`,
    //   );
    // });

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
        schedule_id: info.scheduleId,
        enemy_id_1: levelConfigs[0].id,
        enemy_id_2: levelConfigs[1].id,
        enemy_id_3: levelConfigs[2].id,
      })
      .eq("version_number", version.version_number);
    if (error) throw error;
  });
}

fillStygianEnemyInfo(1);

function makeCoopImg(name_id) {
  if (name_id)
    return `https://api.lunaris.moe/data/assets/coopimg/UI_CoopImg_${name_id}.webp`;
  return null;
}
