/**
 * Shared Abyss / Stygian board helpers (solution pager, slot rates).
 * Mode-specific markup stays in the route pages.
 */

import { teamSlotFieldRate } from "$lib/slot-fields";

export const SOLUTIONS_COUNT = 6;

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

/** Prefer fully-filled solutions; incomplete boards are not shown. */
export function filterDisplaySolutions<T extends { unfilled: string[] }>(
  solutions: T[],
): T[] {
  return solutions.filter((s) => s.unfilled.length === 0);
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

/**
 * Fingerprint character meta used by floorTeamCost / C0R0 seating
 * (name_id + rarity → limited-5★ cost).
 */
export function characterMetaFingerprint(
  mapping: ReadonlyMap<
    string,
    { name_id: string; rarity: number | null | undefined }
  >,
): string {
  if (mapping.size === 0) return "0";
  const parts = [...mapping.values()]
    .map((c) => `${c.name_id}:${c.rarity ?? ""}`)
    .sort();
  return `${parts.length}:${hashString(parts.join("|"))}`;
}

type CheapClearFingerprintRow = {
  team_key: string | null;
  enemy_id: number;
  members?: string[] | null;
  min_cost?: number | null;
  frontier?: unknown;
  usage_rate?: number | null;
  field_1_rate?: number | null;
  field_2_rate?: number | null;
  field_3_rate?: number | null;
};

/** Fingerprint every solver-relevant field of cheap-clear rows. */
export function cheapClearsFingerprint(
  rows: readonly CheapClearFingerprintRow[],
): string {
  if (rows.length === 0) return "0";
  const parts = rows.map((row) =>
    [
      row.team_key ?? "",
      String(row.enemy_id),
      (row.members ?? []).join(","),
      row.min_cost == null ? "" : String(row.min_cost),
      JSON.stringify(row.frontier ?? null),
      row.usage_rate == null ? "" : String(row.usage_rate),
      row.field_1_rate == null ? "" : String(row.field_1_rate),
      row.field_2_rate == null ? "" : String(row.field_2_rate),
      row.field_3_rate == null ? "" : String(row.field_3_rate),
    ].join(":"),
  );
  parts.sort();
  return `${parts.length}:${hashString(parts.join("|"))}`;
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
