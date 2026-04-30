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
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/cron-abyss.ts
 */

import "dotenv/config";
import { supabase } from "./lib/supabase.js";
import {
  fetchYsHelper,
  extractTeams,
  getCurrentVersion,
  extractVersionEntries,
  extractCharacterNames,
  buildCharMapping,
  mapAbyssTeam,
  sleep,
  type AbyssTeam,
} from "./lib/yshelper.js";

const ABYSS_URL = "https://api.yshelper.com/ys/getAbyssRank.php";
const BATCH_SIZE = 10;

// ─── Steps ────────────────────────────────────────────────────────────────────

async function updateVersions(): Promise<void> {
  console.log("Updating abyss versions...");
  const data = await fetchYsHelper(ABYSS_URL);
  const entries = extractVersionEntries(data);

  const { error } = await supabase
    .from("abyss_versions")
    .upsert(
      entries.map((e) => ({
        version_number: e.versionNumber,
        version_name: e.versionName,
      })),
    );
  if (error) throw error;

  console.log(`  ${entries.length} versions`);
}

async function updateTeams(): Promise<void> {
  console.log("Updating abyss teams...");
  const firstData = await fetchYsHelper(ABYSS_URL);
  const versionNumber = getCurrentVersion(firstData);
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
  console.log(
    `  Version ${versionNumber}, ${charMapping.size} mapped characters`,
  );

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
    const names = [...missingAvatars].map((url) => avatarToName.get(url) ?? url);
    console.warn(`  Missing avatars in team data: ${names.join(", ")}`);
  }
  console.log(
    `  Total: ${total} teams (${skipped} skipped — unmapped characters)`,
  );
}

async function flushBatch(batch: AbyssTeam[], idx: number): Promise<void> {
  // Upsert teams
  const { error: teamsErr } = await supabase.from("teams").upsert(
    batch.map((t) => ({ team_key: t.teamKey })),
    { onConflict: "team_key" },
  );
  if (teamsErr) throw teamsErr;

  // Upsert team_characters (all members across all teams in the batch)
  const memberRows = batch.flatMap((t) =>
    t.members.map((m) => ({ team_key: t.teamKey, character_id: m.game_id })),
  );
  const { error: membersErr } = await supabase
    .from("team_characters")
    .upsert(memberRows, { onConflict: "team_key,character_id" });
  if (membersErr) throw membersErr;

  // Upsert team_stats_abyss
  const statsRows = batch.map((t) => ({
    team_key: t.teamKey,
    version_number: t.versionNumber,
    field_1_rate: t.field1Rate,
    field_2_rate: t.field2Rate,
    usage_rate: t.usageRate,
    usage_total: t.usageTotal,
    has_total: t.hasTotal,
  }));
  const { error: statsErr } = await supabase
    .from("team_stats_abyss")
    .upsert(statsRows, { onConflict: "team_key,version_number" });
  if (statsErr) throw statsErr;

  console.log(`  Batch ${idx}: ${batch.length} teams`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("=== Abyss cron start ===");
await updateVersions();
await updateTeams();
console.log("=== Abyss cron complete ===");
