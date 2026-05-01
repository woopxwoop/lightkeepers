/**
 * Abyss cron pipeline.
 *
 * Steps (in order):
 *   1. Update abyss_versions from YSHelper
 *   2. Fetch teams per character, deduplicate, upsert to Supabase
 *
 * Requires enka.ts to have run first to populate the characters table.
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/cron-abyss.ts [version_number]
 */

import "dotenv/config";
import { supabase } from "./lib/supabase.js";
import {
  fetchYsHelper,
  extractTeams,
  extractVersionEntries,
  extractCharacterNames,
  buildCharMapping,
  mapAbyssTeam,
  sleep,
  type AbyssTeam,
  type TeamMember,
} from "./lib/yshelper.js";

const ABYSS_URL = "https://api.yshelper.com/ys/getAbyssRank.php";
const BATCH_SIZE = 10;

// ─── Steps ────────────────────────────────────────────────────────────────────

async function updateVersions(): Promise<void> {
  console.log("Updating abyss versions...");
  const data = await fetchYsHelper(ABYSS_URL);
  const entries = extractVersionEntries(data);

  const { error } = await supabase.from("abyss_versions").upsert(
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
  let batch: AbyssTeam[] = [];
  let batchIdx = 0;
  let total = 0;
  let skipped = 0;

  for (const { name } of ysCharacters) {
    const data = await fetchYsHelper(ABYSS_URL, name, "en", versionNumber);
    await sleep(300);

    for (const raw of extractTeams(data)) {
      const team = mapAbyssTeam(raw, versionNumber, charMapping);
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

async function flushBatch(batch: AbyssTeam[], idx: number): Promise<void> {
  const { error } = await supabase.rpc("upsert_abyss_team_batch", {
    p_teams: batch.map((t) => ({ team_key: t.teamKey })),
    p_members: batch.flatMap((t) =>
      t.members.map((m) => ({ team_key: t.teamKey, character_id: m.game_id })),
    ),
    p_stats: batch.map((t) => ({
      team_key: t.teamKey,
      version_number: t.versionNumber,
      field_1_rate: t.field1Rate,
      field_2_rate: t.field2Rate,
      usage_rate: t.usageRate,
      usage_total: t.usageTotal,
      has_total: t.hasTotal,
    })),
  });
  if (error) throw error;

  console.log(`  Batch ${idx}: ${batch.length} teams`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("=== Abyss cron start ===");
await updateVersions();

const firstData = await fetchYsHelper(ABYSS_URL);
const ysCharacters = extractCharacterNames(firstData);

const { data: dbChars, error: charsErr } = await supabase
  .from("characters")
  .select("game_id, name_id, name");
if (charsErr) throw charsErr;
const { mapping: charMapping, unmapped } = buildCharMapping(
  ysCharacters,
  dbChars,
);

if (!dbChars || dbChars.length === 0 || charMapping.size === 0) {
  throw new Error(
    `Characters table is empty or no characters could be mapped ` +
      `(dbChars.length=${dbChars?.length ?? 0}, ysCharacters.length=${ysCharacters.length}, charMapping.size=${charMapping.size}). ` +
      `Run scripts/enka.ts first to populate the characters table.`,
  );
}

if (unmapped.length > 0) {
  console.warn(
    `  Unmapped characters (${unmapped.length}): ${unmapped.join(", ")}`,
  );
}
console.log(`  ${charMapping.size} mapped characters`);

const allVersions = extractVersionEntries(firstData);
if (allVersions.length === 0) {
  throw new Error("No YSHelper versions found — API may be down or returning unexpected data");
}
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
  `\nUpdating abyss teams for version ${versionToRun.versionNumber} (${versionToRun.versionName})...`,
);
await updateTeams(versionToRun.versionNumber, ysCharacters, charMapping);

console.log("=== Abyss cron complete ===");
