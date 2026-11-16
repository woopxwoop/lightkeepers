/**
 * Stygian solution-board derivations: boss ids, request/memo keys, solver
 * dispatch by mode, clear-video pairs/labels, and the board status branch.
 * Markup stays in `StygianSolutionBoard.svelte` and its children.
 */

import type {
  Character,
  CharacterOwned,
  StygianCheapClearRow,
  StygianClearVideo,
  StygianClearVideoPair,
  StygianEnemies,
  StygianSolverMode,
  StygianTeam,
} from "#lib/definitions.js";
import {
  solveStygianCheapClears,
  solveStygianHybrid,
  solveStygianWithFallback,
  SOLVER_REVISION,
  type Solution,
  type StygianAssignment,
} from "#lib/boards/solver.js";
import {
  SOLUTIONS_COUNT,
  characterMetaFingerprint,
  cheapClearsFingerprint,
  rosterFingerprint,
  teamsFingerprint,
} from "#lib/boards/board-solutions.js";
import {
  c0r0ClearPairKeys,
  clearTimeAtCap,
  clearTimeAtCostCeiling,
  floorTeamCost,
} from "#lib/boards/team-cost.js";
import type { CheapClearsStatus } from "#lib/app/stygian-cheap-clears.js";
import { ownedNameIds } from "#lib/utils.js";

export const STYGIAN_BOARD_SLOTS = ["top", "middle", "bottom"] as const;
export type StygianBoardSlot = (typeof STYGIAN_BOARD_SLOTS)[number];

export type StygianBoardSolution = Solution<StygianAssignment>;

export type StygianSolutionsResult = {
  solutions: StygianBoardSolution[];
  mode: StygianSolverMode | "hybrid" | "yshelper";
};

type BoardEnemies = StygianEnemies | null | undefined;

/** Valid boss ids in slot order (top → bottom). */
export function stygianBossIds(board: BoardEnemies): number[] {
  return STYGIAN_BOARD_SLOTS.map((slot) => board?.[slot]?.id).filter(
    (id): id is number => typeof id === "number" && id > 0,
  );
}

/** Slot → enemy id when all three fields have a boss, else `null`. */
export function stygianSlotEnemies(
  board: BoardEnemies,
): Record<StygianBoardSlot, number> | null {
  const topId = board?.top?.id;
  const middleId = board?.middle?.id;
  const bottomId = board?.bottom?.id;
  return topId && middleId && bottomId
    ? { top: topId, middle: middleId, bottom: bottomId }
    : null;
}

/** Identity of one cheap-clears request (board × roster × retry attempt). */
export function cheapClearsRequestKey(input: {
  boardVersion: number;
  difficulty: string;
  fetchMaxCost: number;
  board: BoardEnemies;
  owned: CharacterOwned[];
  attempt: number;
}): string {
  const ids = stygianBossIds(input.board);
  ids.sort((a, b) => a - b);
  return [
    String(input.boardVersion),
    input.difficulty,
    String(input.fetchMaxCost),
    ids.join(","),
    rosterFingerprint(input.owned),
    String(input.attempt),
  ].join(":");
}

type SolveInput = {
  solverMode: StygianSolverMode;
  maxCost: number;
  owned: CharacterOwned[];
  ownedTeams: StygianTeam[];
  allTeams: StygianTeam[];
  mapping: Map<string, Character>;
  slotEnemies: Record<StygianBoardSlot, number> | null;
  cheapStatus: CheapClearsStatus;
  settledRows: StygianCheapClearRow[] | null;
};

/** Memo key covering every input `solveStygianBoard` reads. */
export function stygianSolutionsKey(input: SolveInput): string {
  const { slotEnemies, settledRows, cheapStatus } = input;
  const cheapKey =
    cheapStatus === "ready" && settledRows
      ? cheapClearsFingerprint(settledRows)
      : cheapStatus;
  return [
    SOLVER_REVISION,
    input.solverMode,
    String(input.maxCost),
    rosterFingerprint(input.owned),
    teamsFingerprint(input.ownedTeams),
    teamsFingerprint(input.allTeams),
    characterMetaFingerprint(input.mapping),
    slotEnemies
      ? `${slotEnemies.top}:${slotEnemies.middle}:${slotEnemies.bottom}`
      : "none",
    cheapKey,
  ].join("|");
}

/** Run the solver that matches the selected mode. */
export function solveStygianBoard(input: SolveInput): StygianSolutionsResult {
  const {
    solverMode,
    slotEnemies,
    cheapStatus,
    settledRows,
    mapping,
    ownedTeams,
    allTeams,
  } = input;
  const videoClearsMode = solverMode === "video-c0r0";

  if (solverMode === "hybrid") {
    if (
      !slotEnemies ||
      cheapStatus === "idle" ||
      cheapStatus === "loading" ||
      cheapStatus === "error"
    ) {
      return { solutions: [], mode: "hybrid" as const };
    }
    const c0r0Pairs = c0r0ClearPairKeys(settledRows ?? [], mapping);
    return {
      solutions: solveStygianHybrid(
        ownedTeams,
        allTeams,
        ownedNameIds(input.owned),
        slotEnemies,
        c0r0Pairs,
        SOLUTIONS_COUNT,
      ),
      mode: "hybrid" as const,
    };
  }

  if (
    videoClearsMode &&
    cheapStatus === "ready" &&
    settledRows &&
    slotEnemies
  ) {
    return {
      solutions: solveStygianCheapClears(
        settledRows,
        slotEnemies,
        SOLUTIONS_COUNT,
        mapping,
        solverMode === "video-c0r0",
        input.maxCost,
      ),
      mode: solverMode,
    };
  }

  if (videoClearsMode) {
    return { solutions: [], mode: solverMode };
  }

  return {
    solutions: solveStygianWithFallback(
      ownedTeams,
      allTeams,
      ownedNameIds(input.owned),
      SOLUTIONS_COUNT,
    ),
    mode: "yshelper" as const,
  };
}

function slotAssignment(
  solution: StygianBoardSolution | undefined,
  slot: StygianBoardSlot,
): StygianAssignment | undefined {
  return solution?.assignments.find((a) => a.slot === slot);
}

/** Changes when the seated teams or difficulty change ("show more" reset). */
export function clearVideosResetKey(
  solution: StygianBoardSolution | undefined,
  difficulty: string,
): string {
  return solution
    ? `${difficulty}|${solution.assignments
        .map((a) => `${a.slot}:${a.team.team_key ?? ""}`)
        .join("|")}`
    : difficulty;
}

/** Team × boss pairs whose clear videos the board shows. */
export function clearVideoPairs(
  solution: StygianBoardSolution,
  board: StygianEnemies,
): StygianClearVideoPair[] {
  return STYGIAN_BOARD_SLOTS.flatMap((slot) => {
    const assignment = slotAssignment(solution, slot);
    const enemy = board[slot];
    const teamKey = assignment?.team?.team_key;
    if (!teamKey || enemy?.id == null) return [];
    return [{ team_key: teamKey, enemy_id: enemy.id }];
  });
}

/** Cached clears for one field, filtered to the board difficulty. */
export function slotClearVideos(
  solution: StygianBoardSolution | undefined,
  board: BoardEnemies,
  slot: StygianBoardSlot,
  difficulty: string,
  cachedFor: (
    teamKey: string,
    enemyId: number,
  ) => StygianClearVideo[] | null | undefined,
): StygianClearVideo[] {
  const assignment = slotAssignment(solution, slot);
  const enemy = board?.[slot];
  const teamKey = assignment?.team?.team_key;
  if (!teamKey || enemy?.id == null) return [];
  const cached = cachedFor(teamKey, enemy.id) ?? [];
  return cached.filter((clear) => clear.difficulty === difficulty);
}

/** Clear time for the team seated in one field, from settled cheap-clear rows. */
export function slotClearTime(input: {
  solution: StygianBoardSolution | undefined;
  board: BoardEnemies;
  slot: StygianBoardSlot;
  rows: StygianCheapClearRow[] | null;
  solverMode: StygianSolverMode;
  maxCost: number;
  mapping: Map<string, Character>;
}): number | null {
  const assignment = slotAssignment(input.solution, input.slot);
  const enemy = input.board?.[input.slot];
  const row = input.rows
    ? input.rows.find(
        (candidate) =>
          candidate.team_key === assignment?.team.team_key &&
          candidate.enemy_id === enemy?.id,
      )
    : undefined;
  if (!row || !assignment) return null;
  if (input.solverMode === "video-c0r0") {
    return clearTimeAtCostCeiling(
      row,
      floorTeamCost(assignment.team.members ?? [], input.mapping),
    );
  }
  return clearTimeAtCap(row, input.maxCost);
}

function videoHostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("youtu")) return "YouTube";
    if (host.includes("bilibili")) return "Bilibili";
    return "Video";
  } catch {
    return "Video";
  }
}

/** "YouTube · Fearless · cost 2 · 95s" style label for one clear video. */
export function clearVideoLabel(clear: StygianClearVideo): string {
  const host = videoHostLabel(clear.video_url);
  const cost = clear.cost != null ? `cost ${clear.cost}` : null;
  const time = clear.time_s != null ? `${clear.time_s}s` : null;
  const bits = [clear.difficulty, cost, time].filter(Boolean);
  return bits.length ? `${host} · ${bits.join(" · ")}` : host;
}

export type StygianBoardStatus =
  | "owned-failed"
  | "owned-pending"
  | "clears-error"
  | "clears-loading"
  | "clears-unavailable"
  | "none"
  | "board";

/** Which panel the board body shows, in priority order. */
export function stygianBoardStatus(input: {
  ownedTeamsFailed: boolean;
  waitingForOwned: boolean;
  needsCheapClears: boolean;
  cheapStatus: CheapClearsStatus;
  outcome: "board" | "none";
}): StygianBoardStatus {
  if (input.ownedTeamsFailed) return "owned-failed";
  if (input.waitingForOwned) return "owned-pending";
  if (input.needsCheapClears && input.cheapStatus === "error") {
    return "clears-error";
  }
  if (input.needsCheapClears && input.cheapStatus === "loading") {
    return "clears-loading";
  }
  if (input.needsCheapClears && input.cheapStatus === "unavailable") {
    return "clears-unavailable";
  }
  if (input.outcome === "none") return "none";
  return "board";
}
