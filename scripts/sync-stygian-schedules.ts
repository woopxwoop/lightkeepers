import { supabase } from "./lib/supabase.js";
import type { Database } from "../src/lib/types/database.types.js";
import { fetchYsHelper, extractVersionEntries } from "./lib/yshelper.js";
import "dotenv/config";

// ─── Types ──────────────────────────────────────────────────────────────────

type EnemyInsert = Database["public"]["Tables"]["enemies"]["Insert"];

interface LevelConfig {
  id: number;
  specialMonsterIcon: string;
  enLevelName: string;
  description?: string;
  [key: string]: unknown;
}

interface Level {
  id: number;
  monsterLevel: number;
  levelConfigs: LevelConfig[];
  [key: string]: unknown;
}

interface LunarisStygianResponse {
  scheduleId: number;
  scheduleStartTime: string; // "2026-05-27 10:00:00"
  scheduleEndTime: string; // "2026-07-08 09:59:59"
  challengeName: string; // "6.6" — corresponds to game version
  levels: Level[];
}

// ─── Routes ────────────────────────────────────────────────────────────────

const LUNARIS_STYGIAN = "https://lunaris.moe/data/leylinechallenge";
const BASE_STYGIAN_ID = 5269001;
const YSHELPER_STYGIAN = "https://api.yshelper.com/ys/getAbyssRank2.php";
const YSHELPER_STYGIAN_VER =
  "https://api.yshelper.com/ys/getAbyssRank2.php?star=all&role=all&lang=en&version=";

// ─── Date helpers ──────────────────────────────────────────────────────────

/**
 * Parse a YSHelper "update" string into the start-of-period date.
 * Stygian form: "Period: 2026-05-27开启" — 开启 means "started"
 */
function parseYshelperDate(update: string): string | null {
  return update.match(/Period:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Convert a Lunaris scheduleStartTime (space-separated "YYYY-MM-DD HH:mm:ss")
 * to a Date. These are timestamps without a timezone suffix, assumed UTC.
 */
function parseLunarisTime(timeStr: string): Date {
  return new Date(timeStr.replace(" ", "T") + "Z");
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────

async function getLunarisStygian(
  scheduleId: number,
): Promise<LunarisStygianResponse | null> {
  const url = `${LUNARIS_STYGIAN}/${scheduleId}.json`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`  Lunaris ${scheduleId}: HTTP ${res.status}`);
    return null;
  }
  // Some Lunaris endpoints return HTML error pages with 200 status.
  // Guard against JSON parse failures so the search doesn't crash.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    console.warn(`  Lunaris ${scheduleId}: non-JSON response (${contentType})`);
    return null;
  }
  try {
    return (await res.json()) as LunarisStygianResponse;
  } catch {
    console.warn(`  Lunaris ${scheduleId}: failed to parse JSON`);
    return null;
  }
}

/**
 * Find the highest existing Lunaris Leyline schedule ID.
 * Uses the latest YSHelper version as a starting point via the
 * known formula: schedule = BASE_STYGIAN_ID + version_number + 1,
 * then walks forward to find the actual max (there may be newer
 * Lunaris schedules without a YSHelper version yet).
 */
async function findMaxLunarisId(latestVersionNumber: number): Promise<number> {
  let id = BASE_STYGIAN_ID + latestVersionNumber + 1;

  // Walk forward until we hit a gap
  while (true) {
    const data = await getLunarisStygian(id + 1);
    if (!data) return id;
    id++;
  }
}

async function fetchYshelperVersion(
  ver: number,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${YSHELPER_STYGIAN_VER}${ver}`);
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

// ─── Main sync ─────────────────────────────────────────────────────────────

async function sync(count: number) {
  // ── 1. Get version history from YSHelper ──────────────────────────────
  console.log("Fetching YSHelper version history...");
  const latest = await fetchYsHelper(YSHELPER_STYGIAN);
  const history = extractVersionEntries(latest);
  console.log(`  YSHelper: ${history.length} known versions`);

  if (history.length === 0) {
    console.log("  No versions found — is the YSHelper API reachable?");
    return;
  }

  // ── 2. Find the max Lunaris schedule ID ──────────────────────────────
  console.log("Finding max Lunaris schedule ID...");
  const maxLunarisId = await findMaxLunarisId(history[0].versionNumber);
  console.log(`  Max Lunaris schedule: ${maxLunarisId}`);

  // ── 3. Sync recent versions ────────────────────────────────────────────
  const toSync = history.slice(0, count);
  console.log(
    `Syncing ${toSync.length} version(s): ${toSync.map((h) => h.versionName).join(", ")}`,
  );

  for (const entry of toSync) {
    const verNum = entry.versionNumber;
    console.log(`\n--- v${verNum} (${entry.versionName}) ---`);

    // ── 3a. Get YSHelper version detail for period date ──────────────────
    const yData = await fetchYshelperVersion(verNum);
    if (!yData?.update) {
      console.log(`  No YSHelper detail for v${verNum}, skipping`);
      continue;
    }

    const ysDate = parseYshelperDate(yData.update as string);
    if (!ysDate) {
      console.log(`  Could not parse date from: "${yData.update}"`);
      continue;
    }
    console.log(`  YSHelper period start: ${ysDate}`);

    // ── 3b. Find matching Lunaris schedule ──────────────────────────────
    //
    // Fast path: try the formula-based ID (same as the original enemy sync).
    //   Lunaris schedule = 5269001 + version_number + 1
    const formulaId = BASE_STYGIAN_ID + verNum + 1;
    let lunarisData: LunarisStygianResponse | null =
      await getLunarisStygian(formulaId);

    if (lunarisData) {
      // Verify date match within tolerance
      const lStart = parseLunarisTime(lunarisData.scheduleStartTime);
      const yParsed = new Date(ysDate);
      const diff = daysBetween(lStart, yParsed);

      if (diff <= 1.5) {
        console.log(
          `  → Matched Lunaris schedule ${lunarisData.scheduleId} (formula, Δ=${diff.toFixed(2)}d)`,
        );
      } else {
        console.log(
          `  Formula gave ${formulaId} but date mismatch (${lunarisData.scheduleStartTime} vs ${ysDate}, Δ=${diff.toFixed(2)}d), searching...`,
        );
        lunarisData = null;
      }
    } else {
      console.log(
        `  Formula schedule ${formulaId} not found on Lunaris, searching...`,
      );
    }

    // Fallback: search by date proximity from max downward
    if (!lunarisData) {
      const yParsed = new Date(ysDate);

      for (let id = maxLunarisId; id >= BASE_STYGIAN_ID; id--) {
        const data = await getLunarisStygian(id);
        if (!data?.scheduleStartTime) continue;

        const lStart = parseLunarisTime(data.scheduleStartTime);
        const diff = daysBetween(lStart, yParsed);

        if (diff <= 1.5) {
          lunarisData = data;
          console.log(
            `  → Matched Lunaris schedule ${data.scheduleId} (date search, Δ=${diff.toFixed(2)}d)`,
          );
          break;
        }

        // Once the schedule start time is well before our target, we've gone too far
        if (lStart < yParsed && diff > 3) break;
      }
    }

    // Guard: if still null after search, skip this version (mirrors abyss-schedules pattern)
    if (!lunarisData) {
      console.log(`  ✗ No matching Lunaris schedule found for v${verNum}`);
      continue;
    }

    // ── 4. Extract and upsert enemies ──────────────────────────────────
    const FEARLESS_LEVEL = 4;
    const levelConfigs = lunarisData.levels[FEARLESS_LEVEL]?.levelConfigs;

    if (!Array.isArray(levelConfigs) || levelConfigs.length < 3) {
      console.log(
        `  ⚠ v${verNum}: fewer than 3 level configs at fearless level, skipping enemy upsert`,
      );
    } else {
      // Upsert unique enemies to the `enemies` table
      const seenEnemyIds = new Set<number>();
      const enemiesToUpsert: EnemyInsert[] = [];

      for (const config of levelConfigs) {
        if (!seenEnemyIds.has(config.id)) {
          seenEnemyIds.add(config.id);
          enemiesToUpsert.push({
            id: config.id,
            enemy_name: config.enLevelName,
            asset: config.specialMonsterIcon,
            icon_path: "leyline",
            description: config.description ?? null,
          });
        }
      }

      if (enemiesToUpsert.length > 0) {
        const { error } = await supabase
          .from("enemies")
          .upsert(enemiesToUpsert, { onConflict: "id" });
        if (error) {
          console.error(`  Enemy upsert error: ${error.message}`);
        } else {
          console.log(`  Upserted ${enemiesToUpsert.length} enemies`);
        }
      }

      // Upsert version→enemy join rows (slot_index 0=top, 1=middle, 2=bottom)
      const joinRows = levelConfigs.slice(0, 3).map((config, i) => ({
        version_number: verNum,
        enemy_id: config.id,
        slot_index: i,
      }));

      const { error: joinErr } = await supabase
        .from("stygian_version_enemies")
        .upsert(joinRows, { onConflict: "version_number,slot_index" });
      if (joinErr) {
        console.error(`  Version-enemy join error: ${joinErr.message}`);
      } else {
        console.log(`  Synced ${joinRows.length} version→enemy joins`);
      }
    }

    // ── 5. Upsert schedule metadata ────────────────────────────────────

    // The YSHelper API doesn't include a buff/blessing field for Stygian.
    // If one becomes available in the future, add a `buff_name` column to
    // the table and map it here.

    const scheduleRow = {
      schedule_id: lunarisData.scheduleId,
      open_time: lunarisData.scheduleStartTime,
      close_time: lunarisData.scheduleEndTime,
      challenge_name: lunarisData.challengeName ?? null,
      levels: lunarisData.levels as any,
      ys_stygian_version: verNum,
    };

    if (!scheduleRow.open_time) {
      console.log(
        `  ⚠ v${verNum}: Lunaris schedule ${lunarisData.scheduleId} has no scheduleStartTime, skipping metadata upsert`,
      );
    } else {
      const { error: upsertErr } = await supabase
        .from("lunaris_stygian_versions")
        .upsert(scheduleRow);

      if (upsertErr) {
        console.error(`  Schedule metadata upsert error: ${upsertErr.message}`);
      } else {
        console.log(
          `  ✓ Synced schedule ${lunarisData.scheduleId} → YSHelper v${verNum}`,
        );

        // Also verify the challengeName ↔ version alignment
        const ysVersionInTitle = entry.versionName ?? "";
        const lunarisVersion = lunarisData.challengeName ?? "";
        if (lunarisVersion && !ysVersionInTitle.includes(lunarisVersion)) {
          console.warn(
            `  ⚠ Version mismatch: Lunaris challengeName="${lunarisVersion}" not found in YSHelper title "${ysVersionInTitle}"`,
          );
        }
      }
    }
  }

  console.log("\nDone.");
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const count = Math.max(1, parseInt(process.argv[2] ?? "1", 10));
console.log(`=== Stygian schedule sync (latest ${count}) ===`);
sync(count).catch(console.error);
