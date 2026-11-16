/**
 * Run: pnpm exec tsx --test src/lib/boards/stygian-board.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  Character,
  CharacterOwned,
  StygianClearVideo,
  StygianEnemies,
  StygianTeam,
} from "../definitions.ts";
import {
  cheapClearsRequestKey,
  clearVideoLabel,
  clearVideoPairs,
  clearVideosResetKey,
  slotClearTime,
  slotClearVideos,
  solveStygianBoard,
  stygianBoardStatus,
  stygianBossIds,
  stygianSlotEnemies,
  stygianSolutionsKey,
  type StygianBoardSolution,
} from "./stygian-board.ts";

const enemy = (id: number) =>
  ({ id, enemy_name: `Boss ${id}`, asset: null }) as StygianEnemies["top"];

const board = (
  top: number | null,
  middle: number | null,
  bottom: number | null,
): StygianEnemies => ({
  top: top == null ? null : enemy(top),
  middle: middle == null ? null : enemy(middle),
  bottom: bottom == null ? null : enemy(bottom),
});

const team = (team_key: string, members: string[] = []) =>
  ({ team_key, members }) as unknown as StygianTeam;

const solution = (
  keys: Partial<Record<"top" | "middle" | "bottom", string>>,
): StygianBoardSolution => ({
  assignments: Object.entries(keys).map(([slot, key]) => ({
    slot: slot as "top" | "middle" | "bottom",
    team: team(key!),
    missingCharacters: [],
  })),
  score: 0,
  unfilled: [],
  isFallback: false,
  neededCharacters: [],
});

const clear = (overrides: Partial<StygianClearVideo>): StygianClearVideo => ({
  clear_key: "k",
  team_key: "t",
  enemy_id: 1,
  difficulty: "Fearless",
  cost: null,
  time_s: null,
  video_url: "https://www.youtube.com/watch?v=x",
  char_names: [],
  ...overrides,
});

describe("stygianBossIds / stygianSlotEnemies", () => {
  it("keeps positive ids in slot order", () => {
    assert.deepEqual(stygianBossIds(board(3, 0, 1)), [3, 1]);
    assert.deepEqual(stygianBossIds(null), []);
  });

  it("maps slots only when all three bosses exist", () => {
    assert.deepEqual(stygianSlotEnemies(board(3, 2, 1)), {
      top: 3,
      middle: 2,
      bottom: 1,
    });
    assert.equal(stygianSlotEnemies(board(3, null, 1)), null);
    assert.equal(stygianSlotEnemies(undefined), null);
  });
});

describe("cheapClearsRequestKey", () => {
  it("sorts boss ids and fingerprints owned characters", () => {
    const owned = [
      { name_id: "b", isOwned: true },
      { name_id: "a", isOwned: true },
      { name_id: "c", isOwned: false },
    ] as CharacterOwned[];
    assert.equal(
      cheapClearsRequestKey({
        boardVersion: 7,
        difficulty: "Fearless",
        fetchMaxCost: 4,
        board: board(30, 10, 20),
        owned,
        attempt: 2,
      }),
      "7:Fearless:4:10,20,30:a,b:2",
    );
  });
});

describe("stygianSolutionsKey / solveStygianBoard", () => {
  const base = {
    maxCost: 2,
    owned: [] as CharacterOwned[],
    ownedTeams: [] as StygianTeam[],
    allTeams: [] as StygianTeam[],
    mapping: new Map<string, Character>(),
    slotEnemies: { top: 1, middle: 2, bottom: 3 },
    settledRows: null,
  };

  it("uses the cheap status in the key until rows are ready", () => {
    const loading = stygianSolutionsKey({
      ...base,
      solverMode: "hybrid",
      cheapStatus: "loading",
    });
    assert.ok(loading.endsWith("|1:2:3|loading"));
    const noBoard = stygianSolutionsKey({
      ...base,
      solverMode: "hybrid",
      slotEnemies: null,
      cheapStatus: "idle",
    });
    assert.ok(noBoard.endsWith("|none|idle"));
  });

  it("returns no solutions while hybrid clears are pending", () => {
    assert.deepEqual(
      solveStygianBoard({
        ...base,
        solverMode: "hybrid",
        cheapStatus: "error",
      }),
      { solutions: [], mode: "hybrid" },
    );
  });

  it("returns no solutions in video mode without ready rows", () => {
    assert.deepEqual(
      solveStygianBoard({
        ...base,
        solverMode: "video-c0r0",
        cheapStatus: "loading",
      }),
      { solutions: [], mode: "video-c0r0" },
    );
  });

  it("falls back to the usage solver in yshelper mode", () => {
    const result = solveStygianBoard({
      ...base,
      solverMode: "yshelper",
      cheapStatus: "idle",
    });
    assert.equal(result.mode, "yshelper");
  });
});

describe("clear videos", () => {
  it("reset key tracks difficulty and seated teams", () => {
    assert.equal(clearVideosResetKey(undefined, "Fearless"), "Fearless");
    assert.equal(
      clearVideosResetKey(solution({ top: "a", middle: "b" }), "Fearless"),
      "Fearless|top:a|middle:b",
    );
  });

  it("pairs seated teams with their field boss", () => {
    assert.deepEqual(
      clearVideoPairs(solution({ top: "a", bottom: "c" }), board(1, 2, null)),
      [{ team_key: "a", enemy_id: 1 }],
    );
  });

  it("filters cached clears to the board difficulty", () => {
    const cached = [
      clear({ clear_key: "1", difficulty: "Fearless" }),
      clear({ clear_key: "2", difficulty: "Dire" }),
    ];
    const seen: [string, number][] = [];
    const result = slotClearVideos(
      solution({ middle: "b" }),
      board(1, 2, 3),
      "middle",
      "Fearless",
      (teamKey, enemyId) => {
        seen.push([teamKey, enemyId]);
        return cached;
      },
    );
    assert.deepEqual(seen, [["b", 2]]);
    assert.deepEqual(
      result.map((c) => c.clear_key),
      ["1"],
    );
    assert.deepEqual(
      slotClearVideos(
        undefined,
        board(1, 2, 3),
        "top",
        "Fearless",
        () => cached,
      ),
      [],
    );
  });

  it("labels clears by host, difficulty, cost and time", () => {
    assert.equal(
      clearVideoLabel(clear({ cost: 2, time_s: 95 })),
      "YouTube · Fearless · cost 2 · 95s",
    );
    assert.equal(
      clearVideoLabel(clear({ video_url: "https://www.bilibili.com/video/x" })),
      "Bilibili · Fearless",
    );
    assert.equal(
      clearVideoLabel(
        clear({ video_url: "not a url", difficulty: "" as never }),
      ),
      "Video",
    );
  });
});

describe("slotClearTime", () => {
  it("is null without a matching settled row", () => {
    assert.equal(
      slotClearTime({
        solution: solution({ top: "a" }),
        board: board(1, 2, 3),
        slot: "top",
        rows: null,
        solverMode: "hybrid",
        maxCost: 2,
        mapping: new Map(),
      }),
      null,
    );
    assert.equal(
      slotClearTime({
        solution: solution({ top: "a" }),
        board: board(1, 2, 3),
        slot: "top",
        rows: [],
        solverMode: "hybrid",
        maxCost: 2,
        mapping: new Map(),
      }),
      null,
    );
  });
});

describe("stygianBoardStatus", () => {
  const base = {
    ownedTeamsFailed: false,
    waitingForOwned: false,
    needsCheapClears: true,
    cheapStatus: "ready" as const,
    outcome: "board" as const,
  };

  it("prefers roster failures over clears and outcome", () => {
    assert.equal(
      stygianBoardStatus({
        ...base,
        ownedTeamsFailed: true,
        waitingForOwned: true,
        cheapStatus: "error",
      }),
      "owned-failed",
    );
    assert.equal(
      stygianBoardStatus({ ...base, waitingForOwned: true }),
      "owned-pending",
    );
  });

  it("maps clear statuses only when clears are needed", () => {
    assert.equal(
      stygianBoardStatus({ ...base, cheapStatus: "error" }),
      "clears-error",
    );
    assert.equal(
      stygianBoardStatus({ ...base, cheapStatus: "loading" }),
      "clears-loading",
    );
    assert.equal(
      stygianBoardStatus({ ...base, cheapStatus: "unavailable" }),
      "clears-unavailable",
    );
    assert.equal(
      stygianBoardStatus({
        ...base,
        needsCheapClears: false,
        cheapStatus: "error",
      }),
      "board",
    );
  });

  it("is none when no complete board exists", () => {
    assert.equal(stygianBoardStatus({ ...base, outcome: "none" }), "none");
  });
});
