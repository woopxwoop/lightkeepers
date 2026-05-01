/**
 * Stygian cron pipeline.
 *
 * Steps (in order):
 *   1. Update stygian_versions from YSHelper
 *   2. Fetch teams per character, deduplicate, upsert to Supabase
 *
 * Requires enka.ts to have run first to populate the characters table.
 * Run lunaris.ts after this to populate stygian_version_enemies.
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/cron-stygian.ts
 */

import "dotenv/config";
import { supabase } from "./lib/supabase.js";
import {
  fetchYsHelper,
  extractTeams,
  extractVersionEntries,
  extractCharacterNames,
  buildCharMapping,
  mapStygianTeam,
  sleep,
  type StygianTeam,
  type TeamMember,
} from "./lib/yshelper.js";

const STYGIAN_URL = "https://api.lelaer.com/ys/getAbyssRank2.php";
const BATCH_SIZE = 10;

// ─── Steps ────────────────────────────────────────────────────────────────────

async function updateVersions(): Promise<void> {
  console.log("Updating stygian versions...");
  const data = await fetchYsHelper(STYGIAN_URL);
  const entries = extractVersionEntries(data);

  const { error } = await supabase.from("stygian_versions").upsert(
    entries.map((e) => ({
      version_number: e.versionNumber,
      version_name: e.versionName,
    })),
  );
  if (error) throw error;

  console.log(`  ${entries.length} versions`);
}

async function updateTeams(
  versionNumber: number,
  ysCharacters: { name: string; avatar: string }[],
  charMapping: Map<string, TeamMember>,
): Promise<void> {
  const avatarToName = new Map(ysCharacters.map((c) => [c.avatar, c.name]));
  const missingAvatars = new Set<string>();

  const seenKeys = new Set<string>();
  let batch: StygianTeam[] = [];
  let batchIdx = 0;
  let total = 0;
  let skipped = 0;

  for (const { name } of ysCharacters) {
    const data = await fetchYsHelper(STYGIAN_URL, name, "en", versionNumber);
    await sleep(300);

    for (const raw of extractTeams(data)) {
      const team = mapStygianTeam(raw, versionNumber, charMapping);
      if (!team) {
        for (const r of raw.role) {
          if (!charMapping.has(r.avatar)) missingAvatars.add(r.avatar);
        }
        skipped++;
        continue;
      }
      if (seenKeys.has(team.teamKey)) continue;
      seenKeys.add(team.teamKey);
      batch.push(team);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch, ++batchIdx);
        total += batch.length;
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch, ++batchIdx);
    total += batch.length;
  }

  if (missingAvatars.size > 0) {
    const names = [...missingAvatars].map(
      (url) => avatarToName.get(url) ?? url,
    );
    console.warn(`  Missing avatars in team data: ${names.join(", ")}`);
  }
  console.log(
    `  Total: ${total} teams (${skipped} skipped — unmapped characters)`,
  );
}

async function flushBatch(batch: StygianTeam[], idx: number): Promise<void> {
  const { error } = await supabase.rpc("upsert_stygian_team_batch", {
    p_teams: batch.map((t) => ({ team_key: t.teamKey })),
    p_members: batch.flatMap((t) =>
      t.members.map((m) => ({ team_key: t.teamKey, character_id: m.game_id })),
    ),
    p_stats: batch.map((t) => ({
      team_key: t.teamKey,
      version_number: t.versionNumber,
      field_1_rate: t.field1Rate,
      field_2_rate: t.field2Rate,
      field_3_rate: t.field3Rate,
      usage_rate: t.usageRate,
      usage_total: t.usageTotal,
      has_total: t.hasTotal,
    })),
  });
  if (error) throw error;

  console.log(`  Batch ${idx}: ${batch.length} teams`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function refreshViews(): Promise<void> {
  console.log("Refreshing stygian views...");
  const { error } = await supabase.rpc("refresh_stygian_views" as never);
  if (error) throw error;
  console.log("  Done");
}

console.log("=== Stygian cron start ===");
await updateVersions();

const firstData = await fetchYsHelper(STYGIAN_URL);
const ysCharacters = extractCharacterNames(firstData);

const { data: dbChars, error: charsErr } = await supabase
  .from("characters")
  .select("game_id, name_id, name");
if (charsErr) throw charsErr;
const { mapping: charMapping, unmapped } = buildCharMapping(
  ysCharacters,
  dbChars,
);

if (unmapped.length > 0) {
  console.warn(
    `  Unmapped characters (${unmapped.length}): ${unmapped.join(", ")}`,
  );
}
console.log(`  ${charMapping.size} mapped characters`);

const allVersions = extractVersionEntries(firstData);
let versionToRun;
if (!process.argv[2]) {
  versionToRun = allVersions[0];
} else {
  const argVersion = parseInt(process.argv[2], 10);
  if (Number.isNaN(argVersion)) {
    throw new Error(
      `Invalid CLI version argument: "${process.argv[2]}" is not a valid integer`,
    );
  }
  versionToRun = allVersions.find((v) => v.versionNumber === argVersion);
  if (!versionToRun) {
    throw new Error(`Version ${argVersion} not found in YSHelper history`);
  }
}

console.log(
  `\nUpdating stygian teams for version ${versionToRun.versionNumber} (${versionToRun.versionName})...`,
);
await updateTeams(versionToRun.versionNumber, ysCharacters, charMapping);

await refreshViews();
console.log("=== Stygian cron complete ===");
