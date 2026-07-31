/**
 * Shared Abyss / Stygian board helpers (solution pager, meta ranking, slot rates).
 * Mode-specific markup stays in the route pages.
 */

import { teamSlotFieldRate } from "$lib/slot-fields";

export const SOLUTIONS_COUNT = 6;
export const META_LEADERBOARD_COUNT = 5;

export type BoardSlot = "top" | "middle" | "bottom";

type SlotRateTeam = {
  usage_rate?: number | null;
  field_1_rate?: number | null;
  field_2_rate?: number | null;
  field_3_rate?: number | null;
  members?: string[] | null;
  team_key?: string | null;
};

type SolutionLike = {
  unfilled: string[];
  assignments: { slot: string; team: { team_key: string | null } }[];
};

/** Slot → field_*_rate (shared mapping with solver via slot-fields). */
export function boardSlotRate(team: SlotRateTeam, slot: string): number {
  return teamSlotFieldRate(team, slot);
}

/** Popularity × slot preference — ranks teams for a specific half/field. */
export function boardSlotScore(team: SlotRateTeam, slot: string): number {
  return (team.usage_rate ?? 0) * (boardSlotRate(team, slot) / 100);
}

/** Prefer fully-filled solutions; otherwise show up to 3 incomplete ones. */
export function filterDisplaySolutions<T extends { unfilled: string[] }>(
  solutions: T[],
): T[] {
  const complete = solutions.filter((s) => s.unfilled.length === 0);
  return complete.length > 0 ? complete : solutions.slice(0, 3);
}

export function clampSolutionIndex(
  selectedIndex: number,
  length: number,
): number {
  return Math.min(selectedIndex, Math.max(0, length - 1));
}

export function stepSolutionIndex(
  safeIndex: number,
  delta: number,
  length: number,
): number | null {
  const next = safeIndex + delta;
  if (next < 0 || next > length - 1) return null;
  return next;
}

export function assignmentKeyFor(
  solution: SolutionLike | undefined,
  slot: string,
): string {
  const teamKey = solution?.assignments.find(
    (assignment) => assignment.slot === slot,
  )?.team.team_key;
  return `${slot}:${String(teamKey ?? "empty")}`;
}

/** Top-N teams per slot by usage index (4-member teams only). */
export function metaLeaderboardBySlot<T extends SlotRateTeam>(
  teams: T[],
  slots: readonly string[],
  count = META_LEADERBOARD_COUNT,
): Record<string, T[]> {
  const valid = teams.filter((team) => (team.members ?? []).length === 4);
  return Object.fromEntries(
    slots.map((slot) => [
      slot,
      [...valid]
        .sort((a, b) => boardSlotScore(b, slot) - boardSlotScore(a, slot))
        .slice(0, count),
    ]),
  );
}

/** Stable fingerprint for memoizing solver runs. */
export function rosterFingerprint(
  characters: { name_id: string; isOwned: boolean }[],
): string {
  return characters
    .filter((c) => c.isOwned)
    .map((c) => c.name_id)
    .sort()
    .join(",");
}

export function teamsFingerprint(teams: { team_key: string | null }[]): string {
  if (teams.length === 0) return "0";
  const keys = teams.map((t) => t.team_key ?? "").sort();
  return `${keys.length}:${keys[0]}:${keys[keys.length - 1]}:${hashString(keys.join("|"))}`;
}

function hashString(s: string): string {
  // FNV-1a 32-bit — fast content stamp for memo keys (not cryptographic).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Memoize an expensive compute by string key (module-level last-result cache).
 * Safe for single-threaded UI; one cache slot per factory instance.
 */
export function createMemo<T>(): (key: string, compute: () => T) => T {
  let lastKey = "";
  let lastValue: T | undefined;
  return (key, compute) => {
    if (key === lastKey && lastValue !== undefined) return lastValue;
    const value = compute();
    lastKey = key;
    lastValue = value;
    return value;
  };
}
