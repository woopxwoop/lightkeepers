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
  extractCharacterNames,
  getCurrentVersion,
  mapAbyssTeam,
  mapStygianTeam,
  type ApiResponse,
} from "./lib/yshelper.js";

const ABYSS_URL = "https://api.yshelper.com/ys/getAbyssRank.php";
const STYGIAN_URL = "https://api.lelaer.com/ys/getAbyssRank2.php";

// ── Supabase reads ────────────────────────────────────────────────────────────

console.log("\n── Supabase reads ───────────────────────────────");

let byName = new Map<string, { game_id: number; name_id: string }>();
let charMapping = new Map<string, { game_id: number; name_id: string }>();
let sampleAbyssRole: string | null = null;
let sampleStygianRole: string | null = null;

function isExpectedHelperConstraintError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "23514" ||
    (message.includes("p_name_ids") &&
      (message.includes("check constraint") || message.includes("violates constraint")))
  );
}

await check("url_to_character_mapping is readable", async () => {
  const { data, error } = await supabase
    .from("characters")
    .select("game_id, name_id, name");
  if (error) throw error;
  assert(Array.isArray(data) && data.length > 0, "characters table returned no rows");
  const { error: apiErr } = await supabase.rpc("get_teams_with_characters_subset", { p_name_ids: [], p_version_number: 0 });
  if (apiErr && !isExpectedHelperConstraintError(apiErr)) throw apiErr;
  byName = new Map<string, { game_id: number; name_id: string }>();
  for (const r of data) {
    if (!r.name) {
      throw new Error(`characters row ${r.game_id} is missing name`);
    }
    if (r.name_id == null) {
      throw new Error(`characters row ${r.game_id} (${r.name}) is missing name_id`);
    }

    const existing = byName.get(r.name);
    if (existing) {
      throw new Error(
        `duplicate character name "${r.name}" in characters table: ` +
          `existing game_id=${existing.game_id}, name_id=${existing.name_id}; ` +
          `duplicate game_id=${r.game_id}, name_id=${r.name_id}`,
      );
    }

    byName.set(r.name, { game_id: r.game_id, name_id: r.name_id });
  }
  assert(byName.size > 0, "characters table resolved to 0 usable entries");
  ok("characters table mapping is buildable", `${byName.size} entries`);
});

await check("versions table is readable", async () => {
  const { data, error } = await supabase
    .from("abyss_versions")
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

await check("character mapping is buildable", async () => {
  assert(abyssData !== null, "abyss data unavailable");
  const names = extractCharacterNames(abyssData!);
  for (const c of names) {
    const m = byName.get(c.name);
    if (m) {
      charMapping.set(c.avatar, m);
      if (!sampleAbyssRole) sampleAbyssRole = c.name;
    }
  }
  assert(charMapping.size > 0, "character mapping resolved to 0 entries");
  ok("character mapping is buildable", `${charMapping.size} entries`);
});

if (stygianData) {
  const stygianNames = extractCharacterNames(stygianData);
  sampleStygianRole = stygianNames[0]?.name ?? null;
}

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
    const chars = extractCharacterNames(abyssData!);
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
    let droppedCount = 0;
    const mapped = rawTeams
      .map((raw) => {
        const team = mapAbyssTeam(raw, versionNumber, charMapping);
        if (team === null) droppedCount += 1;
        return team;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const totalMembers = mapped.reduce((n, t) => n + t.members.length, 0);

    assert(mapped.length > 0, "no teams mapped");
    assert(mapped.every((t) => t.teamKey.length === 64), "some team keys are not SHA-256");

    const droppedPct = rawTeams.length > 0 ? (droppedCount / rawTeams.length) * 100 : 0;
    if (droppedPct > 5) {
      throw new Error(
        `${droppedCount}/${rawTeams.length} teams dropped (${droppedPct.toFixed(1)}%) — character mapping may be stale`,
      );
    }
    ok(
      "mapAbyssTeam produces valid teams",
      `${mapped.length} teams, dropped ${droppedCount}/${rawTeams.length} (${droppedPct.toFixed(1)}%)`,
    );
  });
}

if (stygianData && charMapping.size > 0) {
  await check("mapStygianTeam produces valid teams", async () => {
    const versionNumber = getCurrentVersion(stygianData!);
    const rawTeams = extractTeams(stygianData!);
    let droppedCount = 0;
    const mapped = rawTeams
      .map((raw) => {
        const team = mapStygianTeam(raw, versionNumber, charMapping);
        if (team === null) droppedCount += 1;
        return team;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    assert(mapped.length > 0, "no stygian teams mapped");
    assert(mapped.every((t) => t.teamKey.length === 64), "some team keys are not SHA-256");
    const droppedPct = rawTeams.length > 0 ? (droppedCount / rawTeams.length) * 100 : 0;
    if (droppedPct > 5) {
      throw new Error(
        `${droppedCount}/${rawTeams.length} stygian teams dropped (${droppedPct.toFixed(1)}%) — character mapping may be stale`,
      );
    }
    ok(
      "mapStygianTeam produces valid teams",
      `${mapped.length} teams, dropped ${droppedCount}/${rawTeams.length} (${droppedPct.toFixed(1)}%)`,
    );
  });
}

// ── Per-character fetch (one sample) ─────────────────────────────────────────

console.log("\n── Per-character fetch (1 sample) ───────────────");

await check(`fetchYsHelper role=${sampleAbyssRole ?? "n/a"} (abyss)`, async () => {
  assert(charMapping.size > 0, "character mapping resolved to 0 entries");
  assert(sampleAbyssRole !== null, "no abyss sample role available");
  const data = await fetchYsHelper(ABYSS_URL, sampleAbyssRole, "en");
  const teams = extractTeams(data);
  assert(teams.length > 0, `role ${sampleAbyssRole} returned 0 abyss teams`);
  ok(`fetchYsHelper role=${sampleAbyssRole} (abyss)`, `${teams.length} teams returned`);
});

await check(`fetchYsHelper role=${sampleStygianRole ?? "n/a"} (stygian)`, async () => {
  assert(charMapping.size > 0, "character mapping resolved to 0 entries");
  assert(sampleStygianRole !== null, "no stygian sample role available");
  const data = await fetchYsHelper(STYGIAN_URL, sampleStygianRole, "en");
  const teams = extractTeams(data);
  assert(teams.length > 0, `role ${sampleStygianRole} returned 0 stygian teams`);
  ok(`fetchYsHelper role=${sampleStygianRole} (stygian)`, `${teams.length} teams returned`);
});

summary();
