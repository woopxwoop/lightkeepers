/**
 * Greedy team assignment for Abyss (2 slots) and Stygian (3 slots).
 *
 * For each of the top CANDIDATE_DEPTH teams as a forced first pick, fill the
 * remaining slots by repeatedly choosing the best (team × open slot) pair
 * (usage × slot affinity, with a minimum slot-rate floor), then try pairwise
 * swaps. Rank solutions by 0.6×weakest-link + 0.4×mean so one weak half tanks
 * the score. Fallback helpers allow a small budget of missing characters when
 * the owned roster can't cover every slot.
 */

import type { AbyssTeam, StygianCheapClearRow, StygianTeam } from "$lib/definitions";
import { teamSlotFieldRate } from "$lib/slot-fields";
import {
  clearTimeAtCap,
  clearTimeAtCostCeiling,
  floorTeamCost,
} from "$lib/team-cost";
import type { CharacterMeta } from "$lib/tierlist";

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
  return (team.field_1_rate ?? 0) >= (team.field_2_rate ?? 0)
    ? "top"
    : "bottom";
}

function preferredStygianSlot(team: StygianTeam): StygianSlot {
  const t = team.field_1_rate ?? 0;
  const m = team.field_3_rate ?? 0;
  const b = team.field_2_rate ?? 0;
  if (t >= m && t >= b) return "top";
  if (m >= t && m >= b) return "middle";
  return "bottom";
}

// ---- Slot viability -------------------------------------------------------
// Minimum field/half rate for a team to be seated there — enforced on every
// placement path (slot-aware fill and forced-first).
const MIN_SLOT_RATE = 10; // 10%

type FieldRateTeamLike = {
  field_1_rate?: number | null;
  field_2_rate?: number | null;
  field_3_rate?: number | null;
};

function slotRate<TTeam extends FieldRateTeamLike>(
  team: TTeam,
  slot: string,
): number {
  return teamSlotFieldRate(team, slot);
}

function isSlotViable(team: FieldRateTeamLike, slot: string): boolean {
  return slotRate(team, slot) >= MIN_SLOT_RATE;
}

// ---- Core greedy pass -----------------------------------------------------

/** Per-assignment weight used both for fill decisions and final scoring. */
function placementScore(
  team: {
    usage_rate: number | null;
    field_1_rate: number | null;
    field_2_rate: number | null;
    [key: string]: unknown;
  },
  slot: string,
): number {
  if (!isSlotViable(team, slot)) {
    return Number.NEGATIVE_INFINITY;
  }
  return (team.usage_rate ?? 0) * slotAffinityRate(team, slot);
}

type PlacementTeamLike = {
  members: string[] | null;
};

/**
 * Mutable state for one greedy board build.
 */
function createPlacementContext<
  TTeam extends PlacementTeamLike,
  TSlot extends string,
>(allSlots: TSlot[]) {
  const usedCharacters = new Set<string>();
  const filledSlots = new Set<TSlot>();
  const usedTeams = new Set<TTeam>();
  const assignments: { team: TTeam; slot: TSlot }[] = [];

  return {
    assignments,
    canUseTeam(team: TTeam): boolean {
      return (
        !usedTeams.has(team) &&
        !team.members?.some((member) => usedCharacters.has(member))
      );
    },
    isSlotFilled(slot: TSlot): boolean {
      return filledSlots.has(slot);
    },
    commit(team: TTeam, slot: TSlot): void {
      assignments.push({ team, slot });
      filledSlots.add(slot);
      usedTeams.add(team);
      team.members?.forEach((member) => usedCharacters.add(member));
    },
    get isComplete(): boolean {
      return filledSlots.size >= allSlots.length;
    },
    get unfilled(): TSlot[] {
      return allSlots.filter((slot) => !filledSlots.has(slot));
    },
  };
}

/**
 * Slot-aware greedy: after an optional forced first pick, repeatedly assign the
 * unused team × open slot pair with the highest placement score (no character
 * overlap). Beats “walk list by usage, park in preferred-or-first-open.”
 * Slots below MIN_SLOT_RATE are never filled — leave them empty instead.
 */
function greedyPass<
  TTeam extends Record<string, unknown> & {
    members: string[] | null;
    usage_rate: number | null;
    field_1_rate: number | null;
    field_2_rate: number | null;
    field_3_rate?: number | null;
    team_key: string | null;
  },
  TSlot extends string,
>(
  teams: TTeam[],
  allSlots: TSlot[],
  getPreferredSlot: (team: TTeam) => TSlot,
  forcedFirst?: TTeam,
): Solution<{ team: TTeam; slot: TSlot }> {
  const placement = createPlacementContext<TTeam, TSlot>(allSlots);

  const pickBest = (): boolean => {
    let bestTeam: TTeam | null = null;
    let bestSlot: TSlot | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const team of teams) {
      if (!placement.canUseTeam(team)) continue;

      for (const slot of allSlots) {
        if (placement.isSlotFilled(slot)) continue;
        const score = placementScore(team, slot);
        if (score > bestScore) {
          bestScore = score;
          bestTeam = team;
          bestSlot = slot;
        }
      }
    }

    if (bestTeam == null || bestSlot == null) return false;
    placement.commit(bestTeam, bestSlot);
    return true;
  };

  if (forcedFirst) {
    const open = allSlots.filter((s) => isSlotViable(forcedFirst, s));
    if (open.length > 0) {
      const preferred = getPreferredSlot(forcedFirst);
      const slot = open.includes(preferred)
        ? preferred
        : open.reduce((best, s) =>
            placementScore(forcedFirst, s) > placementScore(forcedFirst, best)
              ? s
              : best,
          );
      placement.commit(forcedFirst, slot);
    }
  }

  while (!placement.isComplete) {
    if (!pickBest()) break;
  }

  return {
    assignments: placement.assignments,
    score: scoreAssignments(placement.assignments),
    unfilled: placement.unfilled,
    isFallback: false,
    neededCharacters: [],
  };
}

/** Score after slot placement — must be recomputed if assignments are swapped. */
export function scoreAssignments(
  assignments: {
    team: {
      usage_rate: number | null;
      field_1_rate: number | null;
      field_2_rate: number | null;
      [key: string]: unknown;
    };
    slot: string;
  }[],
): number {
  if (assignments.length === 0) return 0;
  const weighted = assignments.map(
    (a) => (a.team.usage_rate ?? 0) * slotAffinityRate(a.team, a.slot),
  );
  const min = Math.min(...weighted);
  const mean = weighted.reduce((s, v) => s + v, 0) / weighted.length;
  // 60% weakest-link, 40% average — penalises lopsided solutions
  // without ignoring the strength of the other teams
  return 0.6 * min + 0.4 * mean;
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
    field_1_rate: number | null;
    field_2_rate: number | null;
    [key: string]: unknown;
  },
  slot: string,
): number {
  const t = team.field_1_rate ?? 0;
  const b = team.field_2_rate ?? 0;
  const m = typeof team.field_3_rate === "number" ? team.field_3_rate : 0;
  const total = t + b + m;
  if (total === 0) return 1;
  if (slot === "top") return t / total;
  if (slot === "bottom") return b / total;
  if (slot === "middle") return m / total;
  return 1;
}
/** Heap’s algorithm is not used here — recursive head-selection of all
 *  orderings. Cost is O(n!) in the length of `items` (2! / 3! for board sizes).
 */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const head = items[i]!;
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([head, ...tail]);
  }
  return out;
}

/**
 * Reassign the same teams across their filled slots, picking the seating with
 * the best scoreAssignments. Evaluates all 2-/3-slot permutations (covers
 * pairwise swaps and three-cycles). Every seating must clear MIN_SLOT_RATE.
 */
function optimizeSlots<
  TTeam extends Record<string, unknown> & {
    usage_rate: number | null;
    field_1_rate: number | null;
    field_2_rate: number | null;
    field_3_rate?: number | null;
  },
  TSlot extends string,
>(assignments: { team: TTeam; slot: TSlot }[]): { team: TTeam; slot: TSlot }[] {
  if (assignments.length <= 1) {
    return assignments.map((a) => ({ ...a }));
  }

  const teams = assignments.map((a) => a.team);
  const slots = assignments.map((a) => a.slot);
  let best = assignments.map((a) => ({ ...a }));
  let bestScore = scoreAssignments(best);

  for (const perm of permutations(slots)) {
    const candidate = teams.map((team, i) => ({ team, slot: perm[i]! }));
    if (candidate.some((a) => !isSlotViable(a.team, a.slot as string))) {
      continue;
    }
    const score = scoreAssignments(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** @internal Exported for unit tests — Stygian seat permutation search. */
export function optimizeStygianSlotAssignments(
  assignments: { team: StygianTeam; slot: StygianSlot }[],
): { team: StygianTeam; slot: StygianSlot }[] {
  return optimizeSlots(assignments);
}

/** How many teams to try as forced first pick when exploring solutions */
const CANDIDATE_DEPTH = 20;

const ABYSS_SLOT_ORDER: AbyssSlot[] = ["top", "bottom"];
const STYGIAN_SLOT_ORDER: StygianSlot[] = ["top", "middle", "bottom"];
const MIN_ABYSS_USAGE_TOTAL = 0.001;
/** Drop near-zero meta teams — shown as "0.0% usage" and not worth recommending. */
export const MIN_USAGE_RATE = 0.1;
/** Bump when solver policy changes so page memos cannot reuse stale boards. */
export const SOLVER_REVISION = 7;

function teamUsageRate(team: { usage_rate?: number | null }): number {
  const value = Number(team.usage_rate);
  return Number.isFinite(value) ? value : 0;
}

function isRecommendableTeam(team: {
  members: string[] | null;
  usage_rate?: number | null;
}): boolean {
  return (
    (team.members ?? []).length === 4 && teamUsageRate(team) >= MIN_USAGE_RATE
  );
}

/** Highest usage first — CANDIDATE_DEPTH must explore the meta peak, not array order. */
function byUsageDesc<T extends { usage_rate?: number | null }>(
  teams: T[],
): T[] {
  return [...teams].sort((a, b) => teamUsageRate(b) - teamUsageRate(a));
}

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
  const validTeams = byUsageDesc(
    teams.filter(
      (t) =>
        isRecommendableTeam(t) && (t.usage_total ?? 0) >= MIN_ABYSS_USAGE_TOTAL,
    ),
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
    const optimized = optimizeSlots(sol.assignments);
    const assignments = sortAssignments(optimized, allSlots).map((a) => ({
      ...a,
      missingCharacters: [] as string[],
    }));
    return {
      ...sol,
      assignments,
      // Affinity is slot-dependent — recompute after optimizeSlots swaps.
      score: scoreAssignments(assignments),
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
  const validTeams = byUsageDesc(teams.filter(isRecommendableTeam));
  const allSlots = STYGIAN_SLOT_ORDER;
  const candidates = validTeams.slice(0, CANDIDATE_DEPTH);

  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(
      validTeams,
      allSlots,
      preferredStygianSlot,
      forcedFirst,
    );
    const optimized = optimizeSlots(sol.assignments);
    const assignments = sortAssignments(optimized, allSlots).map((a) => ({
      ...a,
      missingCharacters: [] as string[],
    }));
    return {
      ...sol,
      assignments,
      score: scoreAssignments(assignments),
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

/** How many hybrid forced-first boards to explore before ranking by C0R0 seats. */
const HYBRID_POOL = 12;

function hasC0r0Clear(
  teamKey: string | null,
  enemyId: number,
  c0r0Pairs: ReadonlySet<string>,
): boolean {
  return teamKey != null && c0r0Pairs.has(`${teamKey}|${enemyId}`);
}

function c0r0SeatCoverage(
  solution: Solution<StygianAssignment>,
  slotEnemies: Record<StygianSlot, number>,
  c0r0Pairs: ReadonlySet<string>,
): number {
  let covered = 0;
  for (const assignment of solution.assignments) {
    if (
      hasC0r0Clear(
        assignment.team.team_key,
        slotEnemies[assignment.slot],
        c0r0Pairs,
      )
    ) {
      covered += 1;
    }
  }
  return covered;
}

/**
 * Slot fill: prefer a C0R0 clear for that boss, then usage × affinity.
 * Forced-first still walks the usage peak so meta boards stay in the pool.
 */
function greedyHybridPass(
  teams: StygianTeam[],
  slotEnemies: Record<StygianSlot, number>,
  c0r0Pairs: ReadonlySet<string>,
  forcedFirst?: StygianTeam,
): Solution<StygianAssignment> {
  const placement = createPlacementContext<StygianTeam, StygianSlot>(
    STYGIAN_SLOT_ORDER,
  );

  const pairRank = (
    team: StygianTeam,
    slot: StygianSlot,
  ): { cover: number; usage: number } => {
    if (!isSlotViable(team, slot)) {
      return { cover: -1, usage: Number.NEGATIVE_INFINITY };
    }
    return {
      cover: hasC0r0Clear(team.team_key, slotEnemies[slot], c0r0Pairs)
        ? 1
        : 0,
      usage: placementScore(team, slot),
    };
  };

  const better = (
    a: { cover: number; usage: number },
    b: { cover: number; usage: number },
  ): boolean => a.cover > b.cover || (a.cover === b.cover && a.usage > b.usage);

  const pickBest = (): boolean => {
    let bestTeam: StygianTeam | null = null;
    let bestSlot: StygianSlot | null = null;
    let best = { cover: -1, usage: Number.NEGATIVE_INFINITY };

    for (const team of teams) {
      if (!placement.canUseTeam(team)) continue;
      for (const slot of STYGIAN_SLOT_ORDER) {
        if (placement.isSlotFilled(slot)) continue;
        const rank = pairRank(team, slot);
        if (better(rank, best)) {
          best = rank;
          bestTeam = team;
          bestSlot = slot;
        }
      }
    }

    if (bestTeam == null || bestSlot == null || best.cover < 0) return false;
    placement.commit(bestTeam, bestSlot);
    return true;
  };

  if (forcedFirst) {
    const open = STYGIAN_SLOT_ORDER.filter((s) => isSlotViable(forcedFirst, s));
    if (open.length > 0) {
      const preferred = preferredStygianSlot(forcedFirst);
      const slot = open.includes(preferred)
        ? preferred
        : open.reduce((bestSlot, slot) =>
            better(pairRank(forcedFirst, slot), pairRank(forcedFirst, bestSlot))
              ? slot
              : bestSlot,
          );
      placement.commit(forcedFirst, slot);
    }
  }

  while (!placement.isComplete) {
    if (!pickBest()) break;
  }

  // Do not run usage-only slot swaps — they undo C0R0 seat coverage.
  const assignments = sortAssignments(
    placement.assignments,
    STYGIAN_SLOT_ORDER,
  ).map((a) => ({
    ...a,
    missingCharacters: [] as string[],
  }));

  return {
    assignments,
    score: scoreAssignments(assignments),
    unfilled: STYGIAN_SLOT_ORDER.filter(
      (slot) => !assignments.some((a) => a.slot === slot),
    ),
    isFallback: false,
    neededCharacters: [],
  };
}

/**
 * YSHelper-shaped seating that prefers seats with a baseline C0R0 clear for
 * that boss, then ranks boards by how many of the three seats are covered.
 */
export function solveStygianHybrid(
  ownedTeams: StygianTeam[],
  allTeams: StygianTeam[],
  ownedNames: Set<string>,
  slotEnemies: Record<StygianSlot, number>,
  c0r0Pairs: ReadonlySet<string>,
  count = 3,
): Solution<StygianAssignment>[] {
  const validOwned = byUsageDesc(ownedTeams.filter(isRecommendableTeam));
  const candidates = validOwned.slice(0, CANDIDATE_DEPTH);

  const ownedSolutions = deduplicateSolutions(
    candidates.map((forcedFirst) =>
      greedyHybridPass(validOwned, slotEnemies, c0r0Pairs, forcedFirst),
    ),
  )
    .map((solution) => ({ ...solution, isFallback: false }))
    .filter((solution) => solution.unfilled.length === 0);

  let pool = ownedSolutions;
  if (pool.length === 0) {
    pool = buildMinMissingStygianSolutions(allTeams, ownedNames, HYBRID_POOL);
  } else if (pool.length < count) {
    const seen = new Set(pool.map((solution) => solutionTeamKey(solution)));
    const supplemental = buildMinMissingStygianSolutions(
      allTeams,
      ownedNames,
      HYBRID_POOL,
    ).filter((solution) => {
      if (solution.unfilled.length > 0) return false;
      const key = solutionTeamKey(solution);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    pool = [...pool, ...supplemental];
  }

  return [...pool]
    .sort((a, b) => {
      if (a.unfilled.length !== b.unfilled.length) {
        return a.unfilled.length - b.unfilled.length;
      }
      const coverDiff =
        c0r0SeatCoverage(b, slotEnemies, c0r0Pairs) -
        c0r0SeatCoverage(a, slotEnemies, c0r0Pairs);
      if (coverDiff !== 0) return coverDiff;
      return b.score - a.score;
    })
    .slice(0, count);
}

/**
 * Seat fully-owned teams to minimize Σ clear time under a cost ceiling.
 * Rows carry a cost/time Pareto `frontier`. With `enforceCharacterFloor`
 * (Video Clears C0R0), each team uses floor + 0.5; otherwise `maxCost` + 0.5.
 */
export function solveStygianCheapClears(
  rows: StygianCheapClearRow[],
  slotEnemies: Record<StygianSlot, number>,
  count = 3,
  characterByNameId: ReadonlyMap<string, CharacterMeta> = new Map(),
  enforceCharacterFloor = false,
  maxCost = 0,
): Solution<StygianAssignment>[] {
  const timeByPair = new Map<string, number>();
  const teamByKey = new Map<string, StygianTeam>();

  for (const row of rows) {
    if (!row.team_key) continue;
    if (!isRecommendableTeam(row)) continue;
    const time = enforceCharacterFloor
      ? clearTimeAtCostCeiling(
          row,
          floorTeamCost(row.members ?? [], characterByNameId),
        )
      : clearTimeAtCap(row, maxCost);
    if (time == null) continue;
    const key = `${row.team_key}|${row.enemy_id}`;
    const prev = timeByPair.get(key);
    if (prev == null || time < prev) {
      timeByPair.set(key, time);
    }
    if (!teamByKey.has(row.team_key)) {
      teamByKey.set(row.team_key, row);
    }
  }

  const timeFor = (teamKey: string, enemyId: number): number | null => {
    const value = timeByPair.get(`${teamKey}|${enemyId}`);
    return value == null ? null : value;
  };

  const canSeat = (team: StygianTeam, slot: StygianSlot): boolean => {
    if (!team.team_key || !isSlotViable(team, slot)) return false;
    return timeFor(team.team_key, slotEnemies[slot]) != null;
  };

  const seatTime = (team: StygianTeam, slot: StygianSlot): number => {
    return timeFor(team.team_key!, slotEnemies[slot])!;
  };

  const teams = [...teamByKey.values()];
  if (teams.length === 0) return [];

  /** Fastest best-enemy time first — explore quick forced-first picks. */
  const byBestTime = [...teams].sort((a, b) => {
    const best = (team: StygianTeam) => {
      let min = Number.POSITIVE_INFINITY;
      for (const slot of STYGIAN_SLOT_ORDER) {
        if (!canSeat(team, slot)) continue;
        min = Math.min(min, seatTime(team, slot));
      }
      return min;
    };
    return best(a) - best(b);
  });

  const candidates = byBestTime
    .filter((team) => STYGIAN_SLOT_ORDER.some((slot) => canSeat(team, slot)))
    .slice(0, CANDIDATE_DEPTH);

  function greedyFast(
    forcedFirst?: StygianTeam,
  ): Solution<StygianAssignment> {
    const placement = createPlacementContext<StygianTeam, StygianSlot>(
      STYGIAN_SLOT_ORDER,
    );

    const pickBest = (): boolean => {
      let bestTeam: StygianTeam | null = null;
      let bestSlot: StygianSlot | null = null;
      let bestTime = Number.POSITIVE_INFINITY;

      for (const team of teams) {
        if (!placement.canUseTeam(team)) continue;
        for (const slot of STYGIAN_SLOT_ORDER) {
          if (placement.isSlotFilled(slot)) continue;
          if (!canSeat(team, slot)) continue;
          const time = seatTime(team, slot);
          if (time < bestTime) {
            bestTime = time;
            bestTeam = team;
            bestSlot = slot;
          }
        }
      }

      if (bestTeam == null || bestSlot == null) return false;
      placement.commit(bestTeam, bestSlot);
      return true;
    };

    if (forcedFirst) {
      const open = STYGIAN_SLOT_ORDER.filter((s) => canSeat(forcedFirst, s));
      if (open.length > 0) {
        const preferred = preferredStygianSlot(forcedFirst);
        const slot = open.includes(preferred)
          ? preferred
          : open.reduce((best, s) =>
              seatTime(forcedFirst, s) < seatTime(forcedFirst, best) ? s : best,
            );
        placement.commit(forcedFirst, slot);
      }
    }

    while (!placement.isComplete) {
      if (!pickBest()) break;
    }

    const optimized = optimizeCheapSlots(
      placement.assignments,
      canSeat,
      seatTime,
    );
    const assignments = sortAssignments(optimized, STYGIAN_SLOT_ORDER).map(
      (a) => ({
        ...a,
        missingCharacters: [] as string[],
      }),
    );
    const score = assignments.reduce(
      (sum, a) => sum + seatTime(a.team, a.slot),
      0,
    );

    return {
      assignments,
      score,
      unfilled: placement.unfilled,
      isFallback: false,
      neededCharacters: [],
    };
  }

  const solutions = (candidates.length > 0 ? candidates : [undefined]).map(
    (forced) => greedyFast(forced),
  );

  const complete = solutions.filter((sol) => sol.unfilled.length === 0);
  if (complete.length === 0) return [];

  complete.sort((a, b) => a.score - b.score);
  return deduplicateSolutions(complete).slice(0, count);
}

/** Re-seat the same teams to minimize Σ clear time (enemy-specific). */
function optimizeCheapSlots(
  assignments: { team: StygianTeam; slot: StygianSlot }[],
  canSeat: (team: StygianTeam, slot: StygianSlot) => boolean,
  seatTime: (team: StygianTeam, slot: StygianSlot) => number,
): { team: StygianTeam; slot: StygianSlot }[] {
  if (assignments.length <= 1) {
    return assignments.map((a) => ({ ...a }));
  }

  const teams = assignments.map((a) => a.team);
  const slots = assignments.map((a) => a.slot);
  let best = assignments.map((a) => ({ ...a }));
  let bestTime = best.reduce((sum, a) => sum + seatTime(a.team, a.slot), 0);

  for (const perm of permutations(slots)) {
    const candidate = teams.map((team, i) => ({
      team,
      slot: perm[i]!,
    }));
    if (candidate.some((a) => !canSeat(a.team, a.slot))) continue;
    const time = candidate.reduce(
      (sum, a) => sum + seatTime(a.team, a.slot),
      0,
    );
    if (time < bestTime) {
      bestTime = time;
      best = candidate;
    }
  }
  return best;
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
          teamUsageRate(b.team) - teamUsageRate(a.team),
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
          teamUsageRate(b.team) - teamUsageRate(a.team),
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
