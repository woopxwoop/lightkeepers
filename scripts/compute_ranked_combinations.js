/**
 * compute_ranked_combinations.js
 *
 * Runs the solver against all teams for the current meta version and writes
 * pre-ranked combinations to the ranked_combinations table.
 *
 * Run after your view-refresh cron so the team data is up to date.
 *
 * Requires the table (run once in Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS ranked_combinations (
 *       id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *       game_type       text NOT NULL,
 *       version_number  int  NOT NULL,
 *       rank            int  NOT NULL,
 *       score           float NOT NULL,
 *       slot_assignments jsonb NOT NULL,
 *       UNIQUE (game_type, version_number, rank)
 *   );
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... node scripts/compute_ranked_combinations.js
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ── Config ────────────────────────────────────────────────────────────────────

const CANDIDATE_DEPTH = 50;
const MIN_SLOT_RATE = 10;
const MIN_USAGE_TOTAL = 0.001;

const ABYSS_SLOTS = ["top", "bottom"];
const STYGIAN_SLOTS = ["top", "middle", "bottom"];

// ── Solver ────────────────────────────────────────────────────────────────────

function slotRate(team, slot) {
  return team[`usage_rate_${slot}`] ?? 0;
}

function slotAffinityRate(team, slot) {
  const t = team.usage_rate_top ?? 0;
  const m = team.usage_rate_middle ?? 0;
  const b = team.usage_rate_bottom ?? 0;
  const total = t + m + b;
  if (total === 0) return 1;
  if (slot === "top") return t / total;
  if (slot === "bottom") return b / total;
  if (slot === "middle") return m / total;
  return 1;
}

function preferredAbyssSlot(team) {
  return (team.usage_rate_top ?? 0) >= (team.usage_rate_bottom ?? 0)
    ? "top"
    : "bottom";
}

function preferredStygianSlot(team) {
  const t = team.usage_rate_top ?? 0;
  const m = team.usage_rate_middle ?? 0;
  const b = team.usage_rate_bottom ?? 0;
  if (t >= m && t >= b) return "top";
  if (m >= t && m >= b) return "middle";
  return "bottom";
}

function greedyPass(teams, allSlots, getPreferred, forcedFirst) {
  const usedCharacters = new Set();
  const filledSlots = new Set();
  const assignments = [];

  const assign = (team) => {
    const preferred = getPreferred(team);
    const viableSlots = allSlots.filter(
      (s) => !filledSlots.has(s) && slotRate(team, s) >= MIN_SLOT_RATE,
    );
    const slot = viableSlots.includes(preferred) ? preferred : viableSlots[0];
    if (!slot) return false;

    assignments.push({ team, slot });
    filledSlots.add(slot);
    (team.members ?? []).forEach((m) => usedCharacters.add(m));
    return true;
  };

  if (forcedFirst) assign(forcedFirst);

  for (const team of teams) {
    if (filledSlots.size === allSlots.length) break;
    if (team === forcedFirst) continue;
    if ((team.members ?? []).some((m) => usedCharacters.has(m))) continue;
    assign(team);
  }

  let score = 0;
  if (assignments.length > 0) {
    const weighted = assignments.map(
      (a) => (a.team.usage_total ?? 0) * slotAffinityRate(a.team, a.slot),
    );
    const min = Math.min(...weighted);
    const mean = weighted.reduce((s, v) => s + v, 0) / weighted.length;
    score = 0.6 * min + 0.4 * mean;
  }

  return {
    assignments,
    score,
    unfilled: allSlots.filter((s) => !filledSlots.has(s)),
  };
}

function optimizeSlots(assignments, getPreferred) {
  const result = assignments.map((a) => ({ ...a }));
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        if (
          getPreferred(a.team) === b.slot &&
          getPreferred(b.team) === a.slot &&
          slotRate(a.team, b.slot) >= MIN_SLOT_RATE &&
          slotRate(b.team, a.slot) >= MIN_SLOT_RATE
        ) {
          result[i] = { ...a, slot: b.slot };
          result[j] = { ...b, slot: a.slot };
          swapped = true;
        }
      }
    }
  }
  return result;
}

function sortAssignments(assignments, slotOrder) {
  return [...assignments].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot),
  );
}

function deduplicate(solutions) {
  const seen = new Set();
  return solutions.filter((sol) => {
    const key = sol.assignments
      .map((a) => a.team.team_key ?? "")
      .sort()
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function solve(teams, allSlots, getPreferred, count = 50) {
  const valid = teams.filter(
    (t) =>
      (t.members ?? []).length === 4 && (t.usage_total ?? 0) >= MIN_USAGE_TOTAL,
  );
  const candidates = valid.slice(0, CANDIDATE_DEPTH);

  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(valid, allSlots, getPreferred, forcedFirst);
    const optimized = optimizeSlots(sol.assignments, getPreferred);
    return { ...sol, assignments: sortAssignments(optimized, allSlots) };
  });

  const unique = deduplicate(solutions);
  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, count);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.PRIVATE_SUPABASE_KEY;
if (!url || !key) {
  console.error(
    "Error: PUBLIC_SUPABASE_URL and PRIVATE_SUPABASE_KEY must be set",
  );
  process.exit(1);
}

const db = createClient(url, key);

// Latest versions
const { data: abyssVerData } = await db
  .from("versions")
  .select("version_number")
  .order("version_number", { ascending: false })
  .limit(1);
const { data: stygianVerData } = await db
  .from("stygian_versions")
  .select("version_number")
  .order("version_number", { ascending: false })
  .limit(1);

const abyssVersion = abyssVerData[0].version_number;
const stygianVersion = stygianVerData[0].version_number;
console.log(
  `Abyss version: ${abyssVersion}, Stygian version: ${stygianVersion}`,
);

// Fetch all teams
const { data: abyssTeams } = await db.rpc("get_teams_with_characters_subset", {
  p_character_names: [],
  p_version_number: abyssVersion,
});
const { data: stygianTeams } = await db.rpc(
  "get_teams_with_characters_subset_stygian",
  { p_character_names: [], p_version_number: stygianVersion },
);
console.log(
  `Fetched ${abyssTeams.length} abyss teams, ${stygianTeams.length} stygian teams`,
);

// Solve
const abyssRankings = solve(abyssTeams, ABYSS_SLOTS, preferredAbyssSlot);
const stygianRankings = solve(
  stygianTeams,
  STYGIAN_SLOTS,
  preferredStygianSlot,
);
console.log(
  `Generated ${abyssRankings.length} abyss combinations, ${stygianRankings.length} stygian combinations`,
);

// Build rows
const rows = [];
for (const [gameType, rankings, version] of [
  ["abyss", abyssRankings, abyssVersion],
  ["stygian", stygianRankings, stygianVersion],
]) {
  rankings.forEach((sol, idx) => {
    rows.push({
      game_type: gameType,
      version_number: version,
      rank: idx + 1,
      score: sol.score,
      slot_assignments: sol.assignments.map((a) => ({
        slot: a.slot,
        team_key: a.team.team_key,
      })),
    });
  });
}

// Clear old rows for these versions, then insert fresh
for (const [gameType, version] of [
  ["abyss", abyssVersion],
  ["stygian", stygianVersion],
]) {
  await db
    .from("ranked_combinations")
    .delete()
    .eq("game_type", gameType)
    .eq("version_number", version);
}

await db.from("ranked_combinations").insert(rows);
console.log(`Wrote ${rows.length} rows to ranked_combinations`);
