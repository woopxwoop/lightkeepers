/**
 * Smoke-tests the cron pipeline without writing anything to the database.
 *
 * Checks:
 *   1. API reachability + response shape (yshelper.com and lelaer.com)
 *   2. Data extraction (extractTeams, extractVersionEntries, extractCharacters)
 *   3. Team mapping with the real character mapping from Supabase
 *   4. Supabase read access (url_to_character_mapping, versions tables)
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/test-crons.ts
 */

import "dotenv/config";
import { supabase } from "./lib/supabase.js";
import { ok, check, assert, summary } from "./lib/test-runner.js";
import {
  fetchYsHelper,
  extractTeams,
  extractVersionEntries,
  extractCharacters,
  getCurrentVersion,
  mapAbyssTeam,
  mapStygianTeam,
  type ApiResponse,
} from "./lib/yshelper.js";

const ABYSS_URL = "https://api.yshelper.com/ys/getAbyssRank.php";
const STYGIAN_URL = "https://api.lelaer.com/ys/getAbyssRank2.php";

// ── Supabase reads ────────────────────────────────────────────────────────────

console.log("\n── Supabase reads ───────────────────────────────");

let charMapping: Map<string, string> = new Map();

await check("url_to_character_mapping is readable", async () => {
  const { data, error } = await supabase
    .from("url_to_character_mapping")
    .select("url, character_name");
  if (error) throw error;
  assert(Array.isArray(data) && data.length > 0, "table returned no rows");
  charMapping = new Map(data.map((r) => [r.url, r.character_name]));
  ok("url_to_character_mapping is readable", `${charMapping.size} entries`);
});

await check("versions table is readable", async () => {
  const { data, error } = await supabase
    .from("versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  assert(data && data.length > 0, "versions table is empty");
  ok("versions table is readable", `latest abyss version: ${data[0].version_number}`);
});

await check("stygian_versions table is readable", async () => {
  const { data, error } = await supabase
    .from("stygian_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  assert(data && data.length > 0, "stygian_versions table is empty");
  ok("stygian_versions table is readable", `latest stygian version: ${data[0].version_number}`);
});

// ── API connectivity + parsing ────────────────────────────────────────────────

let abyssData: ApiResponse | null = null;
let stygianData: ApiResponse | null = null;

console.log("\n── API connectivity ─────────────────────────────");

await check("yshelper.com is reachable", async () => {
  abyssData = await fetchYsHelper(ABYSS_URL);
  assert(Array.isArray(abyssData.history_list) && abyssData.history_list.length > 0, "history_list missing");
  assert(Array.isArray(abyssData.result) && abyssData.result.length > 0, "result missing");
  ok("yshelper.com is reachable", `version ${getCurrentVersion(abyssData)}`);
});

await check("lelaer.com is reachable", async () => {
  stygianData = await fetchYsHelper(STYGIAN_URL);
  assert(Array.isArray(stygianData.history_list) && stygianData.history_list.length > 0, "history_list missing");
  assert(Array.isArray(stygianData.result) && stygianData.result.length > 0, "result missing");
  ok("lelaer.com is reachable", `version ${getCurrentVersion(stygianData)}`);
});

// ── Data extraction ───────────────────────────────────────────────────────────

console.log("\n── Data extraction ──────────────────────────────");

if (abyssData) {
  await check("extractVersionEntries (abyss)", async () => {
    const entries = extractVersionEntries(abyssData!);
    assert(entries.length > 0, "no version entries");
    assert(entries.every((e) => typeof e.versionNumber === "number" && !isNaN(e.versionNumber)), "invalid version numbers");
    ok("extractVersionEntries (abyss)", `${entries.length} entries`);
  });

  await check("extractCharacters (abyss)", async () => {
    const chars = extractCharacters(abyssData!);
    assert(chars.length > 0, "no characters extracted");
    assert(chars.every((c) => typeof c.name === "string" && c.name.length > 0), "some chars missing name");
    ok("extractCharacters (abyss)", `${chars.length} characters`);
  });

  await check("extractTeams (abyss, role=all)", async () => {
    const teams = extractTeams(abyssData!);
    assert(teams.length > 0, "no teams extracted from role=all response");
    assert(teams.every((t) => Array.isArray(t.role) && t.role.length > 0), "some teams have empty role array");
    ok("extractTeams (abyss)", `${teams.length} teams`);
  });
}

if (stygianData) {
  await check("extractTeams (stygian, role=all)", async () => {
    const teams = extractTeams(stygianData!);
    assert(teams.length > 0, "no teams extracted");
    ok("extractTeams (stygian)", `${teams.length} teams`);
  });
}

// ── Team mapping (uses real DB character mapping) ─────────────────────────────

console.log("\n── Team mapping ─────────────────────────────────");

if (abyssData && charMapping.size > 0) {
  await check("mapAbyssTeam produces valid teams", async () => {
    const versionNumber = getCurrentVersion(abyssData!);
    const rawTeams = extractTeams(abyssData!);
    const mapped = rawTeams.map((raw) => mapAbyssTeam(raw, versionNumber, charMapping));

    const unknownCount = mapped.reduce(
      (n, t) => n + t.members.filter((m) => m.name === "Unknown").length, 0,
    );
    const totalMembers = mapped.reduce((n, t) => n + t.members.length, 0);

    assert(mapped.length > 0, "no teams mapped");
    assert(mapped.every((t) => t.teamKey.length === 64), "some team keys are not SHA-256");

    const unknownPct = totalMembers > 0 ? (unknownCount / totalMembers) * 100 : 0;
    if (unknownPct > 20) {
      throw new Error(
        `${unknownCount}/${totalMembers} members mapped to "Unknown" (${unknownPct.toFixed(1)}%) — character mapping may be stale`,
      );
    }
    ok("mapAbyssTeam produces valid teams", `${mapped.length} teams, ${unknownCount}/${totalMembers} unknown members`);
  });
}

if (stygianData && charMapping.size > 0) {
  await check("mapStygianTeam produces valid teams", async () => {
    const versionNumber = getCurrentVersion(stygianData!);
    const rawTeams = extractTeams(stygianData!);
    const mapped = rawTeams.map((raw) => mapStygianTeam(raw, versionNumber, charMapping));

    assert(mapped.length > 0, "no stygian teams mapped");
    assert(mapped.every((t) => t.teamKey.length === 64), "some team keys are not SHA-256");
    ok("mapStygianTeam produces valid teams", `${mapped.length} teams`);
  });
}

// ── Per-character fetch (one sample) ─────────────────────────────────────────

console.log("\n── Per-character fetch (1 sample) ───────────────");

if (charMapping.size > 0) {
  const sampleChar = charMapping.values().next().value as string;

  await check(`fetchYsHelper role=${sampleChar} (abyss)`, async () => {
    const data = await fetchYsHelper(ABYSS_URL, sampleChar, "en");
    const teams = extractTeams(data);
    ok(`fetchYsHelper role=${sampleChar} (abyss)`, `${teams.length} teams returned`);
  });

  await check(`fetchYsHelper role=${sampleChar} (stygian)`, async () => {
    const data = await fetchYsHelper(STYGIAN_URL, sampleChar, "en");
    const teams = extractTeams(data);
    ok(`fetchYsHelper role=${sampleChar} (stygian)`, `${teams.length} teams returned`);
  });
}

summary();
