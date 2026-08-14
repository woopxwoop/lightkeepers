/**
 * Pull-cost floor + Fearless clear frontier helpers.
 *
 * Floor (C0R0) matches CostPopover: each limited 5★ copy is +1 (no weapons).
 * Baseline scrape allowance is floor + 0.5 so stygian.moe standard-weapon
 * labels still count; a full extra limited copy (+1) does not.
 *
 * RPC rows carry a cost/time Pareto `frontier`; clients pick the best point
 * under an inclusive scrape-cost limit (cap + 0.5 slack).
 */

import type {
  StygianClearFrontierPoint,
  StygianCheapClearFrontier,
} from "$lib/definitions";
import { isLimitedFiveStar, type CharacterMeta } from "$lib/tierlist";

/** Max limited 5★s on a 4-man team — used when fetching enough frontier span. */
export const STYGIAN_C0R0_CLEAR_MAX_COST = 4;

/** Standard-weapon scrape slack (stygian.moe labels these +0.5). */
export const STYGIAN_BASELINE_COST_SLACK = 0.5;

/** Character-only C0R0 floor: one per limited event-banner 5★. */
export function floorTeamCost(
  nameIds: readonly (string | null | undefined)[],
  characterByNameId: ReadonlyMap<string, CharacterMeta>,
): number {
  let cost = 0;
  for (const id of nameIds) {
    if (!id) continue;
    const character = characterByNameId.get(id);
    if (character && isLimitedFiveStar(character)) cost += 1;
  }
  return cost;
}

/**
 * Max scrape cost that still counts as baseline for this roster composition:
 * C0R0 floor + 0.5 (standard weapon), not a full extra limited copy.
 */
export function baselineTeamCost(
  nameIds: readonly (string | null | undefined)[],
  characterByNameId: ReadonlyMap<string, CharacterMeta>,
): number {
  return (
    floorTeamCost(nameIds, characterByNameId) + STYGIAN_BASELINE_COST_SLACK
  );
}

/** Inclusive scrape-cost limit for a user / floor cap (adds +0.5 slack). */
export function scrapeCostLimitForCap(maxCost: number): number {
  if (!Number.isFinite(maxCost) || maxCost < 0)
    return STYGIAN_BASELINE_COST_SLACK;
  return maxCost + STYGIAN_BASELINE_COST_SLACK;
}

/** Normalize RPC / test frontier payloads into `{c,t}` points. */
export function normalizeClearFrontier(
  frontier: StygianCheapClearFrontier["frontier"] | null | undefined,
): StygianClearFrontierPoint[] {
  if (!Array.isArray(frontier)) return [];
  const points: StygianClearFrontierPoint[] = [];
  for (const raw of frontier) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const c = record.c ?? record.cost;
    const t = record.t ?? record.time ?? record.time_s;
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    points.push({ c, t });
  }
  points.sort((a, b) => a.c - b.c || a.t - b.t);
  return points;
}

/**
 * Fastest frontier point with scrape cost ≤ limit, or null if none.
 * Ties on time keep the cheaper cost.
 */
export function bestClearUnderLimit(
  frontier: StygianCheapClearFrontier["frontier"] | null | undefined,
  limit: number,
): StygianClearFrontierPoint | null {
  if (!Number.isFinite(limit)) return null;
  let best: StygianClearFrontierPoint | null = null;
  for (const point of normalizeClearFrontier(frontier)) {
    if (point.c > limit) continue;
    if (
      best == null ||
      point.t < best.t ||
      (point.t === best.t && point.c < best.c)
    ) {
      best = point;
    }
  }
  return best;
}

/** Fastest clear under character-cost cap `maxCost` (+0.5 slack). */
export function clearTimeAtCap(
  row: StygianCheapClearFrontier,
  maxCost: number,
): number | null {
  return (
    bestClearUnderLimit(row.frontier, scrapeCostLimitForCap(maxCost))?.t ?? null
  );
}

/** Scrape cost of the clear that set {@link clearTimeAtCap}. */
export function clearCostAtCap(
  row: StygianCheapClearFrontier,
  maxCost: number,
): number | null {
  return (
    bestClearUnderLimit(row.frontier, scrapeCostLimitForCap(maxCost))?.c ?? null
  );
}

/**
 * Fastest clear under a character-floor ceiling (integer limited-5★ count),
 * with +0.5 standard-weapon slack.
 */
export function clearTimeAtCostCeiling(
  row: StygianCheapClearFrontier,
  ceiling: number,
): number | null {
  if (!Number.isFinite(ceiling) || ceiling < 0) return null;
  return (
    bestClearUnderLimit(row.frontier, scrapeCostLimitForCap(ceiling))?.t ?? null
  );
}

/** Scrape cost of the clear that set {@link clearTimeAtCostCeiling}. */
export function clearCostAtCostCeiling(
  row: StygianCheapClearFrontier,
  ceiling: number,
): number | null {
  if (!Number.isFinite(ceiling) || ceiling < 0) return null;
  return (
    bestClearUnderLimit(row.frontier, scrapeCostLimitForCap(ceiling))?.c ?? null
  );
}

/** True when scrape label ≤ baseline team cost (C0R0 + 0.5). */
export function labeledCostWithinFloor(
  labeledCost: number,
  nameIds: readonly (string | null | undefined)[],
  characterByNameId: ReadonlyMap<string, CharacterMeta>,
): boolean {
  if (!Number.isFinite(labeledCost)) return false;
  return labeledCost <= baselineTeamCost(nameIds, characterByNameId);
}

/**
 * True when this team×enemy row has a Fearless clear within baseline
 * (scrape cost ≤ C0R0 + 0.5).
 */
export function hasBaselineClear(
  row: StygianCheapClearFrontier & {
    members: string[] | null;
  },
  characterByNameId: ReadonlyMap<string, CharacterMeta>,
): boolean {
  const members = row.members ?? [];
  const limit = baselineTeamCost(members, characterByNameId);
  return bestClearUnderLimit(row.frontier, limit) != null;
}

/**
 * team_key|enemy_id pairs with a Fearless clear at or under baseline
 * (C0R0 + 0.5) for that composition.
 */
export function c0r0ClearPairKeys(
  rows: readonly (StygianCheapClearFrontier & {
    team_key: string | null;
    enemy_id: number;
    members: string[] | null;
  })[],
  characterByNameId: ReadonlyMap<string, CharacterMeta>,
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row.team_key) continue;
    if (!hasBaselineClear(row, characterByNameId)) continue;
    keys.add(`${row.team_key}|${row.enemy_id}`);
  }
  return keys;
}
