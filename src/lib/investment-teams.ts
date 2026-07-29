/**
 * Investment team list helpers.
 *
 * Owns the Teams-page display pipeline: tag / cost filters, baseline vs
 * nearest-cost DPS, and owned-first sorting. Exact-cost "best DPS" for
 * character pages lives in `character-teams.ts` (`bestSimAtCost`) — different
 * invariant (highest at exact cost vs first / nearest).
 */

import type { InvestmentFile, InvestmentSim, InvestmentTeam } from "$lib/types/investment";

export type TeamDpsSort = "dps-desc" | "dps-asc";

/** Canonical baseline sim (not peak floor / f2p). */
export function baselineSim(team: InvestmentTeam): InvestmentSim | null {
  return team.results.find((r) => r.kind === "baseline") ?? null;
}

/** First sim at exactly `cost`, or null. */
export function simAtExactCost(
  team: InvestmentTeam,
  cost: number,
): InvestmentSim | null {
  return team.results.find((r) => r.cost === cost) ?? null;
}

/**
 * DPS of the sim whose cost is closest to `cost`.
 * On equal distance, prefers the lower cost; on a further tie, keeps the
 * earlier result in `team.results`.
 */
export function nearestCostDps(team: InvestmentTeam, cost: number): number {
  if (team.results.length === 0) return 0;
  let best = team.results[0]!;
  let bestDist = Math.abs(best.cost - cost);
  for (let i = 1; i < team.results.length; i++) {
    const candidate = team.results[i]!;
    const dist = Math.abs(candidate.cost - cost);
    if (
      dist < bestDist ||
      (dist === bestDist && candidate.cost < best.cost)
    ) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best.dps;
}

/** DPS shown on list cards — baseline, or nearest to the selected cost. */
export function displayDps(
  team: InvestmentTeam,
  selectedCost: number | null,
): number {
  if (selectedCost !== null) return nearestCostDps(team, selectedCost);
  return baselineSim(team)?.dps ?? 0;
}

/** Sim driving hand builds + meta for the current cost filter. */
export function displaySim(
  team: InvestmentTeam,
  selectedCost: number | null,
): InvestmentSim | null {
  if (selectedCost !== null) return simAtExactCost(team, selectedCost);
  return baselineSim(team);
}

/** Whether every character GOOD key is in the owned set. */
export function ownsInvestmentTeam(
  team: InvestmentTeam,
  ownedKeys: ReadonlySet<string>,
): boolean {
  return team.characters.every((k) => ownedKeys.has(k));
}

/** Teams that include every tagged character key. */
export function teamsMatchingTags(
  teams: InvestmentTeam[],
  tags: readonly string[],
): InvestmentTeam[] {
  if (tags.length === 0) return teams;
  return teams.filter((t) => tags.every((tag) => t.characters.includes(tag)));
}

/** Teams that have at least one sim at exactly `cost`. */
export function teamsWithExactCost(
  teams: InvestmentTeam[],
  cost: number,
): InvestmentTeam[] {
  return teams.filter((t) => t.results.some((r) => r.cost === cost));
}

/** Unique costs across teams (prefer merge-time list; else scan). */
export function availableInvestmentCosts(
  data: Pick<InvestmentFile, "teams" | "available_costs">,
): number[] {
  if (data.available_costs?.length) return data.available_costs;
  const set = new Set<number>();
  for (const t of data.teams) {
    for (const r of t.results) set.add(r.cost);
  }
  return [...set].sort((a, b) => a - b);
}

/** Unique character GOOD keys across all teams. */
export function allTeamCharacterKeys(teams: InvestmentTeam[]): string[] {
  const set = new Set<string>();
  for (const t of teams) {
    for (const k of t.characters) set.add(k);
  }
  return [...set];
}

export type SortTeamsForDisplayOptions = {
  selectedCost: number | null;
  sortBy: TeamDpsSort;
  sortOwnedFirst: boolean;
  ownedKeys: ReadonlySet<string>;
};

/**
 * Tag-filtered teams → exact-cost filter → DPS sort, optionally owned-first.
 */
export function sortTeamsForDisplay(
  teams: InvestmentTeam[],
  {
    selectedCost,
    sortBy,
    sortOwnedFirst,
    ownedKeys,
  }: SortTeamsForDisplayOptions,
): InvestmentTeam[] {
  let next = teams;
  if (selectedCost !== null) {
    next = teamsWithExactCost(next, selectedCost);
  }

  const comparator =
    sortBy === "dps-desc"
      ? (a: InvestmentTeam, b: InvestmentTeam) =>
          displayDps(b, selectedCost) - displayDps(a, selectedCost)
      : (a: InvestmentTeam, b: InvestmentTeam) =>
          displayDps(a, selectedCost) - displayDps(b, selectedCost);

  const sorted = [...next];
  if (sortOwnedFirst) {
    const owned = sorted.filter((t) => ownsInvestmentTeam(t, ownedKeys));
    const notOwned = sorted.filter((t) => !ownsInvestmentTeam(t, ownedKeys));
    owned.sort(comparator);
    notOwned.sort(comparator);
    return [...owned, ...notOwned];
  }

  sorted.sort(comparator);
  return sorted;
}
