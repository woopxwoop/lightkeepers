import type { AbyssTeam, StygianTeam } from "$lib/definitions";

// ---- Types ----------------------------------------------------------------

type AbyssSlot = "top" | "bottom";
type StygianSlot = "top" | "middle" | "bottom";

export type AbyssAssignment = {
  team: AbyssTeam;
  slot: AbyssSlot;
  missingCharacters: string[];
};
export type StygianAssignment = {
  team: StygianTeam;
  slot: StygianSlot;
  missingCharacters: string[];
};

export type Solution<T> = {
  assignments: T[];
  score: number;
  unfilled: string[];
  isFallback: boolean;
  neededCharacters: string[];
};

function solutionTeamKey<T extends { team: { team_key: string | null } }>(
  solution: Solution<T>,
): string {
  return solution.assignments
    .map((assignment) => assignment.team.team_key ?? "")
    .sort()
    .join("|");
}

// ---- Slot preference ------------------------------------------------------

function preferredAbyssSlot(team: AbyssTeam): AbyssSlot {
  return (team.usage_rate_top ?? 0) >= (team.usage_rate_bottom ?? 0)
    ? "top"
    : "bottom";
}

function preferredStygianSlot(team: StygianTeam): StygianSlot {
  const t = team.usage_rate_top ?? 0;
  const m = team.usage_rate_middle ?? 0;
  const b = team.usage_rate_bottom ?? 0;
  if (t >= m && t >= b) return "top";
  if (m >= t && m >= b) return "middle";
  return "bottom";
}

// ---- Slot viability -------------------------------------------------------
// Minimum usage rate on a given slot for a team to be considered for it.
// Teams below this threshold on a slot are treated as if that slot doesn't exist.
const MIN_SLOT_RATE = 10; // 10% — teams below this on a slot won't be assigned there

function slotRate<TTeam extends Record<string, any>>(
  team: TTeam,
  slot: string,
): number {
  const key = `usage_rate_${slot}`;
  return team[key] ?? 0;
}

// ---- Core greedy pass -----------------------------------------------------

function greedyPass<
  TTeam extends Record<string, unknown> & {
    members: string[] | null;
    usage_total: number | null;
    usage_rate_top: number | null;
    usage_rate_bottom: number | null;
    team_key: string | null;
  },
  TSlot extends string,
>(
  teams: TTeam[],
  allSlots: TSlot[],
  getPreferredSlot: (team: TTeam) => TSlot,
  forcedFirst?: TTeam,
): Solution<{ team: TTeam; slot: TSlot }> {
  const usedCharacters = new Set<string>();
  const filledSlots = new Set<TSlot>();
  const assignments: { team: TTeam; slot: TSlot }[] = [];

  const assign = (team: TTeam): boolean => {
    const preferred = getPreferredSlot(team);
    // Only consider slots where this team has meaningful usage
    const viableSlots = allSlots.filter(
      (s) => !filledSlots.has(s) && slotRate(team, s) >= MIN_SLOT_RATE,
    );
    // Prefer natural slot if viable, otherwise first viable open slot
    const slot = viableSlots.includes(preferred) ? preferred : viableSlots[0];
    if (!slot) return false;

    assignments.push({ team, slot });
    filledSlots.add(slot);
    team.members?.forEach((m) => usedCharacters.add(m));
    return true;
  };

  if (forcedFirst) assign(forcedFirst);

  for (const team of teams) {
    if (filledSlots.size === allSlots.length) break;
    if (team === forcedFirst) continue;
    if (team.members?.some((m) => usedCharacters.has(m))) continue;
    assign(team);
  }

  return {
    assignments,
    score: (() => {
      if (assignments.length === 0) return 0;
      const weighted = assignments.map(
        (a) => (a.team.usage_total ?? 0) * slotAffinityRate(a.team, a.slot),
      );
      const min = Math.min(...weighted);
      const mean = weighted.reduce((s, v) => s + v, 0) / weighted.length;
      // 60% weakest-link, 40% average — penalises lopsided solutions
      // without ignoring the strength of the other teams
      return 0.6 * min + 0.4 * mean;
    })(),
    unfilled: allSlots.filter((s) => !filledSlots.has(s)),
    isFallback: false,
    neededCharacters: [],
  };
}

// ---- Deduplication --------------------------------------------------------

function deduplicateSolutions<
  T extends { assignments: { team: { team_key: string | null } }[] },
>(solutions: T[]): T[] {
  const seen = new Set<string>();
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

export function slotAffinityRate(
  team: {
    usage_rate_top: number | null;
    usage_rate_bottom: number | null;
    [key: string]: unknown;
  },
  slot: string,
): number {
  const t = team.usage_rate_top ?? 0;
  const b = team.usage_rate_bottom ?? 0;
  const m =
    typeof team.usage_rate_middle === "number" ? team.usage_rate_middle : 0;
  const total = t + b + m;
  if (total === 0) return 1;
  if (slot === "top") return t / total;
  if (slot === "bottom") return b / total;
  if (slot === "middle") return m / total;
  return 1;
}
// After the greedy pass, check if any two teams would both prefer each
// other's slots and swap them. Handles the case where forcedFirst grabs
// a slot that a later team would prefer, even though both could swap happily.

function optimizeSlots<
  TTeam extends Record<string, unknown>,
  TSlot extends string,
>(
  assignments: { team: TTeam; slot: TSlot }[],
  getPreferredSlot: (team: TTeam) => TSlot,
): { team: TTeam; slot: TSlot }[] {
  const result = assignments.map((a) => ({ ...a }));
  let swapped = true;
  // Keep iterating until no more beneficial swaps exist
  while (swapped) {
    swapped = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const aPref = getPreferredSlot(a.team);
        const bPref = getPreferredSlot(b.team);
        // Swap only if both prefer each other's slot AND both are viable there
        if (
          aPref === b.slot &&
          bPref === a.slot &&
          slotRate(a.team, b.slot as string) >= MIN_SLOT_RATE &&
          slotRate(b.team, a.slot as string) >= MIN_SLOT_RATE
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

/** How many teams to try as forced first pick when exploring solutions */
const CANDIDATE_DEPTH = 20;

const ABYSS_SLOT_ORDER: AbyssSlot[] = ["top", "bottom"];
const STYGIAN_SLOT_ORDER: StygianSlot[] = ["top", "middle", "bottom"];
const MIN_ABYSS_USAGE_TOTAL = 0.001;

function sortAssignments<T extends { slot: TSlot }, TSlot extends string>(
  assignments: T[],
  slotOrder: TSlot[],
): T[] {
  return [...assignments].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot),
  );
}

export function solveAbyss(
  teams: AbyssTeam[],
  count = 3,
): Solution<AbyssAssignment>[] {
  // Ignore sub-4-member teams — those are high-constellation flex plays, not general suggestions
  const validTeams = teams.filter(
    (t) =>
      (t.members ?? []).length === 4 &&
      (t.usage_total ?? 0) >= MIN_ABYSS_USAGE_TOTAL,
  );
  const allSlots = ABYSS_SLOT_ORDER;
  const candidates = validTeams.slice(0, CANDIDATE_DEPTH);

  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(
      validTeams,
      allSlots,
      preferredAbyssSlot,
      forcedFirst,
    );
    const optimized = optimizeSlots(sol.assignments, preferredAbyssSlot);
    return {
      ...sol,
      assignments: sortAssignments(optimized, allSlots).map((a) => ({
        ...a,
        missingCharacters: [] as string[],
      })),
    };
  });

  return sortSolutionsByMissingThenScore(deduplicateSolutions(solutions)).slice(
    0,
    count,
  );
}

export function solveStygian(
  teams: StygianTeam[],
  count = 3,
): Solution<StygianAssignment>[] {
  const validTeams = teams.filter((t) => (t.members ?? []).length === 4);
  const allSlots = STYGIAN_SLOT_ORDER;
  const candidates = validTeams.slice(0, CANDIDATE_DEPTH);

  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(
      validTeams,
      allSlots,
      preferredStygianSlot,
      forcedFirst,
    );
    const optimized = optimizeSlots(sol.assignments, preferredStygianSlot);
    return {
      ...sol,
      assignments: sortAssignments(optimized, allSlots).map((a) => ({
        ...a,
        missingCharacters: [] as string[],
      })),
    };
  });

  return sortSolutionsByMissingThenScore(deduplicateSolutions(solutions)).slice(
    0,
    count,
  );
}

export function solveAbyssWithFallback(
  ownedTeams: AbyssTeam[],
  allTeams: AbyssTeam[],
  ownedNames: Set<string>,
  count = 3,
): Solution<AbyssAssignment>[] {
  const owned = solveAbyss(ownedTeams, count).map((solution) => ({
    ...solution,
    isFallback: false,
  }));

  const completeOwned = owned.filter(
    (solution) => solution.unfilled.length === 0,
  );

  if (completeOwned.length === 0) {
    return buildMinMissingAbyssSolutions(allTeams, ownedNames, count);
  }

  if (completeOwned.length >= count) {
    return completeOwned.slice(0, count);
  }

  const fallbackSolutions = buildMinMissingAbyssSolutions(
    allTeams,
    ownedNames,
    count,
  ).filter((solution) => solution.unfilled.length === 0);

  const seen = new Set(
    completeOwned.map((solution) => solutionTeamKey(solution)),
  );
  const supplemental = fallbackSolutions.filter((solution) => {
    const key = solutionTeamKey(solution);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...completeOwned, ...supplemental].slice(0, count);
}

export function solveStygianWithFallback(
  ownedTeams: StygianTeam[],
  allTeams: StygianTeam[],
  ownedNames: Set<string>,
  count = 3,
): Solution<StygianAssignment>[] {
  const owned = solveStygian(ownedTeams, count).map((solution) => ({
    ...solution,
    isFallback: false,
  }));

  const completeOwned = owned.filter(
    (solution) => solution.unfilled.length === 0,
  );

  if (completeOwned.length === 0) {
    return buildMinMissingStygianSolutions(allTeams, ownedNames, count);
  }

  if (completeOwned.length >= count) {
    return completeOwned.slice(0, count);
  }

  const fallbackSolutions = buildMinMissingStygianSolutions(
    allTeams,
    ownedNames,
    count,
  ).filter((solution) => solution.unfilled.length === 0);

  const seen = new Set(
    completeOwned.map((solution) => solutionTeamKey(solution)),
  );
  const supplemental = fallbackSolutions.filter((solution) => {
    const key = solutionTeamKey(solution);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...completeOwned, ...supplemental].slice(0, count);
}

// ---- Missing character helpers --------------------------------------------

function getMissingForTeam(
  team: { members: string[] | null },
  ownedNames: Set<string>,
): string[] {
  return (team.members ?? []).filter((member) => !ownedNames.has(member));
}

function annotateSolutionMissing<
  TTeam extends { members: string[] | null },
  TSlot extends string,
>(
  solution: Solution<{ team: TTeam; slot: TSlot }>,
  ownedNames: Set<string>,
): Solution<{ team: TTeam; slot: TSlot; missingCharacters: string[] }> {
  const assignments = solution.assignments.map((assignment) => ({
    ...assignment,
    missingCharacters: getMissingForTeam(assignment.team, ownedNames),
  }));

  return {
    ...solution,
    assignments,
    neededCharacters: [
      ...new Set(
        assignments.flatMap((assignment) => assignment.missingCharacters),
      ),
    ],
  };
}

function totalMissingCount<T extends { missingCharacters: string[] }>(
  assignments: T[],
): number {
  return assignments.reduce(
    (sum, assignment) => sum + assignment.missingCharacters.length,
    0,
  );
}

function sortSolutionsByMissingThenScore<
  T extends { missingCharacters: string[] },
>(solutions: Solution<T>[]): Solution<T>[] {
  return [...solutions].sort((a, b) => {
    if (a.unfilled.length !== b.unfilled.length)
      return a.unfilled.length - b.unfilled.length;

    const aTotalMissing = totalMissingCount(a.assignments);
    const bTotalMissing = totalMissingCount(b.assignments);
    if (aTotalMissing !== bTotalMissing) return aTotalMissing - bTotalMissing;

    const aUniqueMissing = a.neededCharacters.length;
    const bUniqueMissing = b.neededCharacters.length;
    if (aUniqueMissing !== bUniqueMissing)
      return aUniqueMissing - bUniqueMissing;

    return b.score - a.score;
  });
}

// ---- Min-missing fallback helpers -----------------------------------------

function buildMinMissingAbyssSolutions(
  allTeams: AbyssTeam[],
  ownedNames: Set<string>,
  count: number,
): Solution<AbyssAssignment>[] {
  const teamsWithMissing = allTeams.map((team) => ({
    team,
    missing: getMissingForTeam(team, ownedNames),
  }));

  for (let budget = 0; budget <= 4; budget++) {
    const pool = teamsWithMissing
      .filter((entry) => entry.missing.length <= budget)
      .sort(
        (a, b) =>
          a.missing.length - b.missing.length ||
          (b.team.usage_total ?? 0) - (a.team.usage_total ?? 0),
      )
      .map((entry) => entry.team);

    const solutions = solveAbyss(pool, count);
    if (solutions.length > 0 && solutions[0].unfilled.length === 0) {
      return sortSolutionsByMissingThenScore(
        solutions.map((solution) =>
          annotateSolutionMissing(
            { ...solution, isFallback: true },
            ownedNames,
          ),
        ),
      );
    }
  }

  return sortSolutionsByMissingThenScore(
    solveAbyss(allTeams, count).map((solution) =>
      annotateSolutionMissing({ ...solution, isFallback: true }, ownedNames),
    ),
  );
}

function buildMinMissingStygianSolutions(
  allTeams: StygianTeam[],
  ownedNames: Set<string>,
  count: number,
): Solution<StygianAssignment>[] {
  const teamsWithMissing = allTeams.map((team) => ({
    team,
    missing: getMissingForTeam(team, ownedNames),
  }));

  for (let budget = 0; budget <= 4; budget++) {
    const pool = teamsWithMissing
      .filter((entry) => entry.missing.length <= budget)
      .sort(
        (a, b) =>
          a.missing.length - b.missing.length ||
          (b.team.usage_total ?? 0) - (a.team.usage_total ?? 0),
      )
      .map((entry) => entry.team);

    const solutions = solveStygian(pool, count);
    if (solutions.length > 0 && solutions[0].unfilled.length === 0) {
      return sortSolutionsByMissingThenScore(
        solutions.map((solution) =>
          annotateSolutionMissing(
            { ...solution, isFallback: true },
            ownedNames,
          ),
        ),
      );
    }
  }

  return sortSolutionsByMissingThenScore(
    solveStygian(allTeams, count).map((solution) =>
      annotateSolutionMissing({ ...solution, isFallback: true }, ownedNames),
    ),
  );
}
