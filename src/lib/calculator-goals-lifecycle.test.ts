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
  saveGoalsState,
  clearPendingGoalsRecovery,
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

  afterEach(async () => {
    mock.restoreAll();
    clearPendingGoalsRecovery();
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
    assert.equal(result.postCloud, true);
    assert.equal(result.syncError, "");
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
    assert.equal(result.postCloud, true);
    assert.equal(result.syncError, "");
  });

  it("does not POST when a failed cloud read races a same-tab save", async () => {
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
    release(new Response("nope", { status: 500 }));
    const result = await pending;

    assert.equal(result.state.goals[0]?.id, "saved");
    assert.equal(result.postCloud, false);
    assert.equal(result.syncError, "Sync failed (500) — goals not synced");

    let posts = 0;
    mock.method(globalThis, "fetch", async () => {
      posts += 1;
      return new Response("ok", { status: 200 });
    });
    const saved = await saveGoalsState({
      state: result.state,
      pendingRemoveIds: new Set(),
      savedSnapshot: result.json,
      cloud: result.postCloud,
    });
    assert.equal(saved.ok, true);
    assert.equal(posts, 0);
  });

  it("reports a successful reread without replacing local goals", async () => {
    installLocalStorage();
    const local = captureGoals(goalsWith("Hutao", "local"));
    writeGoalsLocal(local.json);
    const revision = get(goalsLocalRevision);
    const cloud = goalsWith("Xingqiu", "cloud");
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ goals: cloud.goals }), { status: 200 }),
    );

    const result = await hydrateGoalsState(true, { replaceLocal: false });

    assert.equal(result.postCloud, false);
    assert.equal(result.syncError, "");
    assert.equal(result.state.goals[0]?.id, "local");
    assert.equal(readGoalsLocal().goals[0]?.id, "local");
    assert.equal(get(goalsLocalRevision), revision);
  });

  it("merges local edits saved after a failed read with the next cloud list", async () => {
    installLocalStorage();
    const base = captureGoals({
      ...emptyGoalsState(),
      goals: [
        createCharacterGoal("Hutao", { id: "hutao" }),
        createCharacterGoal("Xingqiu", { id: "drop" }),
      ],
      selectedId: "hutao",
    });
    writeGoalsLocal(base.json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    const failed = await hydrateGoalsState(true);
    assert.equal(failed.postCloud, false);

    const edited = captureGoals({
      ...emptyGoalsState(),
      goals: [
        createCharacterGoal("Hutao", { id: "hutao" }),
        createCharacterGoal("Yelan", { id: "added" }),
      ],
      selectedId: "added",
    });
    writeGoalsLocal(edited.json);
    const cloudHutao = createCharacterGoal("Hutao", {
      id: "hutao",
      starred: true,
    });
    const cloudOnly = createCharacterGoal("Furina", { id: "cloud-only" });
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            goals: [
              cloudHutao,
              cloudOnly,
              createCharacterGoal("Xingqiu", { id: "drop" }),
            ],
          }),
          { status: 200 },
        ),
    );

    const result = await hydrateGoalsState(true);

    assert.equal(result.postCloud, true);
    assert.deepEqual(
      result.state.goals.map((goal) => goal.id),
      ["hutao", "cloud-only", "added"],
    );
    assert.equal(result.state.goals[0]?.starred, true);
    assert.equal(
      readGoalsLocal().goals.some((goal) => goal.id === "drop"),
      false,
    );

    const again = await hydrateGoalsState(true);
    assert.deepEqual(
      again.state.goals.map((goal) => goal.id),
      ["hutao", "cloud-only", "added"],
    );

    mock.method(globalThis, "fetch", async (_url, init) => {
      if (init?.method === "POST") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({ goals: [cloudHutao, cloudOnly] }), {
        status: 200,
      });
    });
    const saved = await saveGoalsState({
      state: again.state,
      pendingRemoveIds: new Set(),
      savedSnapshot: again.json,
      cloud: true,
    });
    assert.equal(saved.ok, true);
    const afterSave = await hydrateGoalsState(true);
    assert.deepEqual(
      afterSave.state.goals.map((goal) => goal.id),
      ["hutao", "cloud-only"],
    );
  });

  it("does not store cloud goals when the account check fails", async () => {
    installLocalStorage();
    const local = captureGoals(goalsWith("Hutao", "local"));
    writeGoalsLocal(local.json);
    const revision = get(goalsLocalRevision);
    let accept = true;
    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mock.method(globalThis, "fetch", () => gate);

    const pending = hydrateGoalsState(true, { allowWrite: () => accept });
    accept = false;
    release(
      new Response(
        JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
        { status: 200 },
      ),
    );
    const result = await pending;

    assert.equal(result.postCloud, false);
    assert.equal(result.state.goals[0]?.id, "local");
    assert.equal(readGoalsLocal().goals[0]?.id, "local");
    assert.equal(get(goalsLocalRevision), revision);
  });

  it("keeps local and does not POST after a failed cloud read", async () => {
    installLocalStorage();
    const local = captureGoals(goalsWith("Hutao", "local"));
    writeGoalsLocal(local.json);
    const revision = get(goalsLocalRevision);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );

    const result = await hydrateGoalsState(true);

    assert.equal(result.postCloud, false);
    assert.equal(result.syncError, "Sync failed (500) — goals not synced");
    assert.equal(result.state.goals[0]?.id, "local");
    assert.equal(get(goalsLocalRevision), revision);

    let posts = 0;
    mock.method(globalThis, "fetch", async () => {
      posts += 1;
      return new Response("nope", { status: 500 });
    });
    const saved = await saveGoalsState({
      state: result.state,
      pendingRemoveIds: new Set(),
      savedSnapshot: result.json,
      cloud: result.postCloud,
    });
    assert.equal(saved.ok, true);
    assert.equal(posts, 0);
  });

  it("keeps local when the cloud has no row yet", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "local")).json);
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ goals: null }), { status: 200 }),
    );

    const result = await hydrateGoalsState(true);

    assert.equal(result.postCloud, true);
    assert.equal(result.syncError, "");
    assert.equal(result.state.goals[0]?.id, "local");
  });
});
