import type { AbyssTeam, StygianTeam } from "$lib/definitions";

// ---- Types ----------------------------------------------------------------

type AbyssSlot = "top" | "bottom";
type StygianSlot = "top" | "middle" | "bottom";

export type AbyssAssignment = { team: AbyssTeam; slot: AbyssSlot };
export type StygianAssignment = { team: StygianTeam; slot: StygianSlot };

export type Solution<T> = {
  assignments: T[];
  /** Sum of usage_total across all assigned teams — used to rank solutions */
  score: number;
  /** Slots we couldn't fill given the owned roster */
  unfilled: string[];
};

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

// ---- Core greedy pass -----------------------------------------------------

function greedyPass<
  TTeam extends {
    members: string[] | null;
    usage_total: number | null;
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
    const slot = !filledSlots.has(preferred)
      ? preferred
      : allSlots.find((s) => !filledSlots.has(s));
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
    score: assignments.reduce((sum, a) => sum + (a.team.usage_total ?? 0), 0),
    unfilled: allSlots.filter((s) => !filledSlots.has(s)),
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

// ---- Public API -----------------------------------------------------------

/** How many teams to try as forced first pick when exploring solutions */
const CANDIDATE_DEPTH = 20;

const ABYSS_SLOT_ORDER: AbyssSlot[] = ["top", "bottom"];
const STYGIAN_SLOT_ORDER: StygianSlot[] = ["top", "middle", "bottom"];

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
  const validTeams = teams.filter((t) => (t.members ?? []).length === 4);
  const allSlots = ABYSS_SLOT_ORDER;
  const candidates = validTeams.slice(0, CANDIDATE_DEPTH);

  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(
      validTeams,
      allSlots,
      preferredAbyssSlot,
      forcedFirst,
    );
    return { ...sol, assignments: sortAssignments(sol.assignments, allSlots) };
  });

  return deduplicateSolutions(solutions)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
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
    return { ...sol, assignments: sortAssignments(sol.assignments, allSlots) };
  });

  return deduplicateSolutions(solutions)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
