/**
 * Investment team list helpers.
 *
 * Owns the Teams-page display pipeline: tag / exact-cost filters, baseline
 * DPS, and owned-first sorting.
 */

import type {
  InvestmentFile,
  InvestmentSim,
  InvestmentTeam,
} from "$lib/types/investment";

export type TeamDpsSort = "dps-desc" | "dps-asc";

/** Look up a team by key, or null when missing. */
export function findInvestmentTeam(
  file: InvestmentFile | null | undefined,
  teamKey: string,
): InvestmentTeam | null {
  return file?.teams.find((t) => t.team_key === teamKey) ?? null;
}

/** Canonical baseline sim (not peak floor / f2p). */
export function baselineSim(team: InvestmentTeam): InvestmentSim | null {
  return team.results.find((r) => r.kind === "baseline") ?? null;
}

/** Floor + owned alternatives (baseline / f2p / owned), highest DPS first. */
export function baselineVariants(team: InvestmentTeam): InvestmentSim[] {
  return team.results
    .filter(
      (r) => r.kind === "baseline" || r.kind === "f2p" || r.kind === "owned",
    )
    .slice()
    .sort((a, b) => b.dps - a.dps);
}

export type VerticalCostGroup = {
  cost: number;
  sims: InvestmentSim[];
};

/** Vertical upgrades grouped by cost; sims within a cost are DPS-desc. */
export function groupVerticalSimsByCost(
  team: InvestmentTeam,
): VerticalCostGroup[] {
  const groups = new Map<number, InvestmentSim[]>();
  for (const sim of team.results) {
    if (sim.kind !== "vertical") continue;
    const entry = groups.get(sim.cost);
    if (entry) entry.push(sim);
    else groups.set(sim.cost, [sim]);
  }
  for (const sims of groups.values()) {
    sims.sort((a, b) => b.dps - a.dps);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([cost, sims]) => ({ cost, sims }));
}

/** First non-owned sim at exactly `cost`, or null. */
export function simAtExactCost(
  team: InvestmentTeam,
  cost: number,
): InvestmentSim | null {
  return (
    team.results.find((r) => r.cost === cost && r.kind !== "owned") ?? null
  );
}

/** Best DPS at exactly `cost` (skips owned), or 0 when no result matches. */
export function exactCostDps(team: InvestmentTeam, cost: number): number {
  let bestDps = 0;
  for (const result of team.results) {
    if (result.kind === "owned") continue;
    if (result.cost === cost) {
      bestDps = Math.max(bestDps, result.dps);
    }
  }
  return bestDps;
}

/** DPS shown on list cards — baseline, or best at the selected exact cost. */
export function displayDps(
  team: InvestmentTeam,
  selectedCost: number | null,
): number {
  if (selectedCost !== null) return exactCostDps(team, selectedCost);
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

/** Teams that have at least one non-owned sim at exactly `cost`. */
export function teamsWithExactCost(
  teams: InvestmentTeam[],
  cost: number,
): InvestmentTeam[] {
  return teams.filter((t) =>
    t.results.some((r) => r.cost === cost && r.kind !== "owned"),
  );
}

/** Unique costs across teams (prefer merge-time list; else scan). */
export function availableInvestmentCosts(
  data: Pick<InvestmentFile, "teams" | "available_costs">,
): number[] {
  if (data.available_costs?.length) return data.available_costs;
  const set = new Set<number>();
  for (const t of data.teams) {
    for (const r of t.results) {
      if (r.kind === "owned") continue;
      set.add(r.cost);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Unique character GOOD keys across all teams, alphabetically ordered. */
export function allTeamCharacterKeys(teams: InvestmentTeam[]): string[] {
  const set = new Set<string>();
  for (const t of teams) {
    for (const k of t.characters) set.add(k);
  }
  return [...set].sort();
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
