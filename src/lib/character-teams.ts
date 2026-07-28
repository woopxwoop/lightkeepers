import type { AbyssTeam, StygianTeam } from "$lib/definitions";
import type { InvestmentSim, InvestmentTeam } from "$lib/types/investment";

/** Character-page team lists (meta + simulated). */
export const TOP_TEAMS_LIMIT = 6;

/** Default investment cost for character-page sim rankings. */
export const CHARACTER_SIM_COST = 4;

/**
 * Top teams from a meta board that include `nameId`, ranked by usage_rate.
 */
export function topTeamsForCharacter<T extends AbyssTeam | StygianTeam>(
  teams: T[],
  nameId: string,
  limit = TOP_TEAMS_LIMIT,
): T[] {
  return teams
    .filter(
      (t) =>
        (t.members ?? []).length === 4 && (t.members ?? []).includes(nameId),
    )
    .sort((a, b) => (b.usage_rate ?? 0) - (a.usage_rate ?? 0))
    .slice(0, limit);
}

/** Best sim at an exact investment cost, or null. */
export function bestSimAtCost(
  team: InvestmentTeam,
  cost: number,
): InvestmentSim | null {
  let best: InvestmentSim | null = null;
  for (const sim of team.results) {
    if (sim.cost !== cost) continue;
    if (!best || sim.dps > best.dps) best = sim;
  }
  return best;
}

export type RankedSimTeam = {
  team: InvestmentTeam;
  sim: InvestmentSim;
  dps: number;
};

/**
 * Teams featuring `goodKey`, ranked by best DPS at the given investment cost.
 */
export function topSimTeamsForCharacter(
  teams: InvestmentTeam[],
  goodKey: string,
  cost = CHARACTER_SIM_COST,
  limit = TOP_TEAMS_LIMIT,
): RankedSimTeam[] {
  const ranked: RankedSimTeam[] = [];
  for (const team of teams) {
    if (!team.characters.includes(goodKey)) continue;
    const sim = bestSimAtCost(team, cost);
    if (!sim) continue;
    ranked.push({ team, sim, dps: sim.dps });
  }
  ranked.sort((a, b) => b.dps - a.dps);
  return ranked.slice(0, limit);
}
