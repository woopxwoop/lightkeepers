/**
 * Sync the latest abyss schedule(s) from Lunaris into local tables.
 *
 * Fetches the latest N versions from yshelper, matches them to Lunaris
 * schedules by date, then upserts floor/enemy data into:
 *   - `enemies`             — normalized enemy catalog
 *   - `lunaris_abyss_versions` — schedule metadata + floors JSONB
 *
 * Usage:
 *   PUBLIC_SUPUBASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/lunaris.ts [N]
 *
 *   N  — number of recent versions to sync (default: 1)
 */

import { supabase } from "./lib/supabase.js";
import type { Database } from "../src/lib/types/database.types.js";
import "dotenv/config";

type EnemyInsert = Database["public"]["Tables"]["enemies"]["Insert"];
type AbyssVersionInsert = Database["public"]["Tables"]["lunaris_abyss_versions"]["Insert"];

// ─── Routes ─────────────────────────────────────────────────────────────────

const LUNARIS_VERSION = "https://api.lunaris.moe/data/version.json";
const LUNARIS_TOWER = "https://api.lunaris.moe/data";
const YSHELPER_LATEST = "https://api.yshelper.com/ys/getAbyssRank.php?star=4&role=all&lang=en";
const YSHELPER_VER = "https://api.yshelper.com/ys/getAbyssRank.php?star=4&role=all&lang=en&version=";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedMonster {
  id: number; describeId: number; name: string; icon: string; hp: number;
}

interface FloorRecord {
  floorId: number;
  floorIndex: number;
  chambers: {
    levelId: number;
    monsterLevel: number;
    conditions: string[];
    firstHalfMonsters: ParsedMonster[];
    secondHalfMonsters: ParsedMonster[];
  }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Monsters arrive as proper JSON objects from the API — no string parsing needed
function toMonster(raw: unknown): ParsedMonster | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  return typeof m.id === "number" ? (m as unknown as ParsedMonster) : null;
}

/**
 * Parse a yshelper "update" string into the start-of-period date.
 * Normal form: "Period: 2022-09-01 to 2022-9-15"
 * Ongoing form: "Period: 2026-06-16起"
 */
function parseYshelperDate(update: string): string | null {
  return update.match(/Period:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86_400_000);
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

async function getLunarisVersion(): Promise<string> {
  const res = await fetch(LUNARIS_VERSION);
  if (!res.ok) throw new Error(`Lunaris version: HTTP ${res.status}`);
  return ((await res.json()) as { version: string }).version;
}

async function getLunarisSchedule(ver: string, id: number) {
  const url = `${LUNARIS_TOWER}/${ver}/en/tower/${id}.json`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lunaris ${id}: HTTP ${res.status}`);
  return res.json();
}

async function getLatestYshelper() {
  const res = await fetch(YSHELPER_LATEST);
  if (!res.ok) throw new Error(`Yshelper latest: HTTP ${res.status}`);
  return res.json();
}

async function getYshelperVersion(ver: number) {
  const res = await fetch(`${YSHELPER_VER}${ver}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Find the Lunaris schedule whose openTime best matches a yshelper date.
 * Starts from `maxId` and walks backward; returns the first match within
 * the tolerance window.
 */
async function findMatchingLunarisId(
  lunarisVer: string,
  yshelperDate: string,
  maxId: number,
): Promise<number | null> {
  const target = new Date(yshelperDate);
  for (let id = maxId; id >= 1; id--) {
    const data = await getLunarisSchedule(lunarisVer, id);
    if (!data) continue;
    const open = new Date(data.openTime);
    if (daysBetween(open, target) <= 1.5) return id;
    // Once the open time is well before our target, we've gone too far
    if (open < target && daysBetween(open, target) > 3) break;
  }
  return null;
}

/**
 * Find the highest existing Lunaris schedule ID.
 */
async function findMaxLunarisId(lunarisVer: string): Promise<number> {
  let id = 1;
  while (true) {
    const data = await getLunarisSchedule(lunarisVer, id + 100); // jump in 100s
    if (!data) break;
    id += 100;
  }
  // Now binary search or linear walk from here
  while (true) {
    const data = await getLunarisSchedule(lunarisVer, id + 1);
    if (!data) return id;
    id++;
  }
}

// ─── Main sync ──────────────────────────────────────────────────────────────

async function sync(count: number) {
  // 1. Determine version strings
  const lunarisVer = await getLunarisVersion();
  console.log(`Lunaris data version: ${lunarisVer}`);

  const maxLunarisId = await findMaxLunarisId(lunarisVer);
  console.log(`Latest Lunaris schedule: ${maxLunarisId}`);

  // 2. Fetch latest yshelper response to get history_list
  const latest = await getLatestYshelper();
  const history = latest.history_list as { title: string; value: number }[];
  console.log(`Yshelper latest: ${latest.version} (v${history[0].value})`);

  // 3. Take the top N from history
  const toSync = history.slice(0, count);
  console.log(`Syncing ${toSync.length} version(s): ${toSync.map((h: any) => h.title).join(", ")}`);

  for (const entry of toSync) {
    const verNum = entry.value;
    console.log(`\n--- v${verNum} (${entry.title}) ---`);

    // 4. Get yshelper version details for the date
    const yData = await getYshelperVersion(verNum);
    if (!yData?.update) {
      console.log(`  No yshelper data for v${verNum}, skipping`);
      continue;
    }
    const ysDate = parseYshelperDate(yData.update);
    if (!ysDate) {
      console.log(`  Could not parse date from: "${yData.update}"`);
      continue;
    }
    console.log(`  Yshelper period: ${yData.update}`);

    // 5. Find matching Lunaris schedule
    const lunarisId = await findMatchingLunarisId(lunarisVer, ysDate, maxLunarisId);
    if (!lunarisId) {
      console.log(`  No matching Lunaris schedule found`);
      continue;
    }
    console.log(`  Matched to Lunaris schedule ${lunarisId}`);

    // 6. Fetch full abyss data
    const abyssData = await getLunarisSchedule(lunarisVer, lunarisId);
    if (!abyssData) {
      console.log(`  Lunaris schedule ${lunarisId} data not found (race condition?)`);
      continue;
    }

    // 7. Extract all unique enemies and upsert them
    const seenEnemyIds = new Set<number>();
    const enemiesToUpsert: EnemyInsert[] = [];

    for (const floor of abyssData.floors ?? []) {
      for (const chamber of floor.chambers ?? []) {
        for (const half of ["firstHalfMonsters", "secondHalfMonsters"] as const) {
          for (const raw of chamber[half] ?? []) {
            const monster = toMonster(raw);
            if (monster && !seenEnemyIds.has(monster.id)) {
              seenEnemyIds.add(monster.id);
              enemiesToUpsert.push({ id: monster.id, enemy_name: monster.name, asset: monster.icon, icon_path: "monstericon" });
            }
          }
        }
      }
    }

    if (enemiesToUpsert.length > 0) {
      const { error: enemyErr } = await supabase
        .from("enemies")
        .upsert(enemiesToUpsert, { onConflict: "id" });
      if (enemyErr) {
        console.error(`  Enemy upsert error: ${enemyErr.message}`);
      } else {
        console.log(`  Upserted ${enemiesToUpsert.length} enemies`);
      }
    }

    // 8. Build clean floors JSONB
    const floors: FloorRecord[] = (abyssData.floors ?? []).map((floor: any) => ({
      floorId: floor.floorId,
      floorIndex: floor.floorIndex,
      chambers: (floor.chambers ?? []).map((chamber: any) => ({
        levelId: chamber.levelId,
        monsterLevel: chamber.monsterLevel ?? 0,
        conditions: chamber.conditions ?? [],
        firstHalfMonsters: (chamber.firstHalfMonsters ?? [])
          .map((m: unknown) => toMonster(m))
          .filter(Boolean) as ParsedMonster[],
        secondHalfMonsters: (chamber.secondHalfMonsters ?? [])
          .map((m: unknown) => toMonster(m))
          .filter(Boolean) as ParsedMonster[],
      })),
    }));

    // 9. Upsert schedule
    const scheduleRow: AbyssVersionInsert = {
      schedule_id: abyssData.scheduleId,
      open_time: abyssData.openTime,
      close_time: abyssData.closeTime,
      buff_name: abyssData.buffName ?? null,
      floors: floors as any,
      ys_abyss_version: verNum,
    };

    const { error: upsertErr } = await supabase
      .from("lunaris_abyss_versions")
      .upsert(scheduleRow);

    if (upsertErr) {
      console.error(`  Upsert error: ${upsertErr.message}`);
    } else {
      console.log(`  Synced schedule ${lunarisId} → yshelper v${verNum}`);
    }
  }

  console.log(`\nDone.`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const count = Math.max(1, parseInt(process.argv[2] ?? "1", 10));
console.log(`=== Abyss schedule sync (latest ${count}) ===`);
sync(count).catch(console.error);
