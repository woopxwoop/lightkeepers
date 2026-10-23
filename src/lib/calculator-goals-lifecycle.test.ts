import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { get } from "svelte/store";
import {
  createCharacterGoal,
  emptyGoalsState,
  parseGoalsState,
} from "./calculator-goals.ts";
import {
  CALCULATOR_GOALS_STORAGE_KEY,
  captureGoals,
  goalsLocalRevision,
  readGoalsLocal,
  writeGoalsLocal,
} from "./calculator-goals-snapshot.ts";
import {
  goalsHaveUnsavedChanges,
  goalsListDiffersFromSnapshot,
  goalsWithoutPendingRemoves,
  hydrateGoalsState,
} from "./calculator-goals-lifecycle.ts";
import type { CalculatorGoalsState } from "./types/calculator-goals.ts";

describe("calculator goals lifecycle", () => {
  it("strips pending removes before save", () => {
    const state = parseGoalsState({
      goals: [
        createCharacterGoal("Hutao", { id: "a" }),
        createCharacterGoal("Xingqiu", { id: "b" }),
      ],
      selectedId: "a",
    });
    const next = goalsWithoutPendingRemoves(state, new Set(["b"]));
    assert.deepEqual(
      next.goals.map((g) => g.id),
      ["a"],
    );
    assert.equal(next.selectedId, "a");
  });

  it("treats selectedId-only edits as clean", () => {
    const base = emptyGoalsState();
    const withGoal = {
      ...base,
      goals: [createCharacterGoal("Hutao", { id: "a" })],
      selectedId: "a",
    };
    const saved = captureGoals(withGoal).json;
    const reselected = { ...withGoal, selectedId: null };
    assert.equal(goalsListDiffersFromSnapshot(reselected, saved), false);
    assert.equal(
      goalsHaveUnsavedChanges({
        hydrated: true,
        state: reselected,
        savedSnapshot: saved,
        pendingRemoveIds: new Set(),
      }),
      false,
    );
    assert.equal(
      goalsHaveUnsavedChanges({
        hydrated: true,
        state: withGoal,
        savedSnapshot: saved,
        pendingRemoveIds: new Set(["a"]),
      }),
      true,
    );
  });
});

function goalsWith(nameId: string, id: string): CalculatorGoalsState {
  return {
    ...emptyGoalsState(),
    goals: [createCharacterGoal(nameId, { id })],
    selectedId: id,
  };
}

function installLocalStorage(): Map<string, string> {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
  return storage;
}

describe("hydrateGoalsState cloud read", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );

  afterEach(() => {
    mock.restoreAll();
    if (originalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("keeps a same-tab save that lands while the cloud read is in flight", async () => {
    installLocalStorage();
    const older = captureGoals(goalsWith("Hutao", "old"));
    const newer = captureGoals(goalsWith("Xingqiu", "saved"));
    writeGoalsLocal(older.json);

    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mock.method(globalThis, "fetch", () => gate);

    const pending = hydrateGoalsState(true);
    writeGoalsLocal(newer.json);
    const revisionAfterSave = get(goalsLocalRevision);
    release(
      new Response(JSON.stringify({ goals: older.state.goals }), {
        status: 200,
      }),
    );
    const result = await pending;

    assert.equal(get(goalsLocalRevision), revisionAfterSave);
    assert.equal(result.state.goals[0]?.id, "saved");
    assert.equal(readGoalsLocal().goals[0]?.id, "saved");
    const stored = globalThis.localStorage.getItem(
      CALCULATOR_GOALS_STORAGE_KEY,
    );
    assert.equal(stored, newer.json);
  });

  it("still applies cloud goals when nothing was saved during the read", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "old")).json);
    const revision = get(goalsLocalRevision);
    const cloud = goalsWith("Xingqiu", "cloud");
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ goals: cloud.goals }), { status: 200 }),
    );

    const result = await hydrateGoalsState(true);

    assert.equal(get(goalsLocalRevision), revision + 1);
    assert.equal(result.state.goals[0]?.id, "cloud");
    assert.equal(readGoalsLocal().goals[0]?.id, "cloud");
  });
});
