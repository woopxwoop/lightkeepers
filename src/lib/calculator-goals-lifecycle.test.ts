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
  persistGoalsLocal,
  readGoalsLocal,
  writeGoalsLocal,
} from "./calculator-goals-snapshot.ts";
import {
  acceptGoalsHydrationUser,
  clearPendingGoalsRecovery,
  goalsHaveUnsavedChanges,
  goalsListDiffersFromSnapshot,
  goalsRevisionAllowsCloudReplace,
  goalsWithoutPendingRemoves,
  hydrateGoalsState,
  saveGoalsState,
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

function goalsWithStarred(nameId: string, id: string): CalculatorGoalsState {
  return {
    ...emptyGoalsState(),
    goals: [createCharacterGoal(nameId, { id, starred: true })],
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
    const failed = await hydrateGoalsState(true, { userId: "user-a" });
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

    const result = await hydrateGoalsState(true, { userId: "user-a" });
    assert.equal(result.state.goals[0]?.starred, true);
    assert.equal(
      readGoalsLocal().goals.some((goal) => goal.id === "drop"),
      false,
    );

    const newerHutao = createCharacterGoal("Hutao", { id: "hutao" });
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            goals: [
              newerHutao,
              cloudOnly,
              createCharacterGoal("Xingqiu", { id: "drop" }),
            ],
          }),
          { status: 200 },
        ),
    );
    const again = await hydrateGoalsState(true, { userId: "user-a" });
    assert.deepEqual(
      again.state.goals.map((goal) => goal.id),
      ["hutao", "cloud-only", "added"],
    );
    assert.equal(again.state.goals[0]?.starred, undefined);

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
      userId: "user-a",
    });
    assert.equal(saved.ok, true);
    const afterSave = await hydrateGoalsState(true, { userId: "user-a" });
    assert.deepEqual(
      afterSave.state.goals.map((goal) => goal.id),
      ["hutao", "cloud-only"],
    );
  });

  it("does not carry one account's pending edits into another account", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "local")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(
      captureGoals({
        ...emptyGoalsState(),
        goals: [
          createCharacterGoal("Hutao", { id: "local" }),
          createCharacterGoal("Yelan", { id: "added" }),
        ],
        selectedId: "added",
      }).json,
    );
    const cloud = goalsWith("Xingqiu", "cloud");
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ goals: cloud.goals }), { status: 200 }),
    );

    const result = await hydrateGoalsState(true, { userId: "account-b" });

    assert.deepEqual(
      result.state.goals.map((goal) => goal.id),
      ["cloud"],
    );
    assert.equal(result.postCloud, true);
  });

  it("keeps posting off when pending recovery changes during the read", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "local")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-a" });

    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mock.method(globalThis, "fetch", () => gate);
    const pending = hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "edited")).json);
    release(
      new Response(
        JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
        { status: 200 },
      ),
    );
    const result = await pending;

    assert.equal(result.postCloud, false);
    assert.equal(result.state.goals[0]?.id, "edited");
    assert.equal(readGoalsLocal().goals[0]?.id, "edited");
  });

  it("does not let a stale account's failed read replace the current recovery", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "a-start")).json);
    let releaseA!: (value: Response) => void;
    const gateA = new Promise<Response>((resolve) => {
      releaseA = resolve;
    });
    mock.method(globalThis, "fetch", () => gateA);
    let allowA = true;
    const pendingA = hydrateGoalsState(true, {
      userId: "account-a",
      allowWrite: () => allowA,
    });

    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-b" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "b-edited")).json);
    allowA = false;
    releaseA(new Response("nope", { status: 500 }));
    const stale = await pendingA;
    assert.equal(stale.postCloud, false);

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
          { status: 200 },
        ),
    );
    const merged = await hydrateGoalsState(true, { userId: "account-b" });
    assert.equal(
      merged.state.goals.some((goal) => goal.id === "b-edited"),
      true,
    );
  });

  it("does not record a failed read once the account check fails", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "b-base")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-b" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "b-edited")).json);

    let allowA = true;
    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mock.method(globalThis, "fetch", () => gate);
    const pending = hydrateGoalsState(true, {
      userId: "account-a",
      allowWrite: () => allowA,
    });
    allowA = false;
    release(new Response("nope", { status: 500 }));
    await pending;

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
          { status: 200 },
        ),
    );
    const merged = await hydrateGoalsState(true, { userId: "account-b" });
    assert.equal(
      merged.state.goals.some((goal) => goal.id === "b-edited"),
      true,
    );
  });

  it("keeps a newer account's recovery when an older cloud save finishes", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "a-local")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-a" });

    let releasePost!: (value: Response) => void;
    const postGate = new Promise<Response>((resolve) => {
      releasePost = resolve;
    });
    mock.method(globalThis, "fetch", () => postGate);
    const saving = saveGoalsState({
      state: readGoalsLocal(),
      pendingRemoveIds: new Set(),
      savedSnapshot: captureGoals(readGoalsLocal()).json,
      cloud: true,
      userId: "account-a",
    });

    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-b" });
    releasePost(new Response("{}", { status: 200 }));
    const saved = await saving;
    assert.equal(saved.ok, true);

    writeGoalsLocal(captureGoals(goalsWith("Yelan", "b-edited")).json);
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
          { status: 200 },
        ),
    );
    const merged = await hydrateGoalsState(true, { userId: "account-b" });
    assert.equal(
      merged.state.goals.some((goal) => goal.id === "b-edited"),
      true,
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

  it("does not treat a cloud apply as a local edit when an overlapping read fails", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "local")).json);

    let releaseApply!: (value: Response) => void;
    let releaseFail!: (value: Response) => void;
    let calls = 0;
    mock.method(globalThis, "fetch", () => {
      calls += 1;
      return calls === 1
        ? new Promise<Response>((resolve) => {
            releaseApply = resolve;
          })
        : new Promise<Response>((resolve) => {
            releaseFail = resolve;
          });
    });

    const applying = hydrateGoalsState(true, { userId: "account-a" });
    const failing = hydrateGoalsState(true, { userId: "account-a" });
    releaseApply(
      new Response(
        JSON.stringify({ goals: goalsWith("Xingqiu", "c1").goals }),
        { status: 200 },
      ),
    );
    await applying;
    releaseFail(new Response("nope", { status: 500 }));
    const failed = await failing;
    assert.equal(failed.postCloud, false);

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Yelan", "c2").goals }),
          { status: 200 },
        ),
    );
    const again = await hydrateGoalsState(true, { userId: "account-a" });
    assert.deepEqual(
      again.state.goals.map((goal) => goal.id),
      ["c2"],
    );
    assert.equal(again.postCloud, true);
  });

  it("merges a same-tab save with cloud goals that the save does not contain", async () => {
    installLocalStorage();
    const older = captureGoals(goalsWith("Hutao", "hutao"));
    writeGoalsLocal(older.json);

    let release!: (value: Response) => void;
    mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const pending = hydrateGoalsState(true, { userId: "account-a" });
    const saved = captureGoals({
      ...emptyGoalsState(),
      goals: [
        createCharacterGoal("Hutao", { id: "hutao" }),
        createCharacterGoal("Yelan", { id: "added" }),
      ],
      selectedId: "added",
    });
    writeGoalsLocal(saved.json);
    release(
      new Response(
        JSON.stringify({
          goals: [
            createCharacterGoal("Hutao", { id: "hutao", starred: true }),
            createCharacterGoal("Furina", { id: "cloud-only" }),
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await pending;

    assert.equal(result.postCloud, true);
    assert.deepEqual(
      result.state.goals.map((goal) => goal.id),
      ["hutao", "cloud-only", "added"],
    );
    assert.equal(result.state.goals[0]?.starred, true);
    assert.equal(
      readGoalsLocal().goals.some((goal) => goal.id === "added"),
      true,
    );
  });

  it("keeps a goal merged during hydration when a later cloud list omits it", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "hutao")).json);

    let release!: (value: Response) => void;
    mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const pending = hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(
      captureGoals({
        ...emptyGoalsState(),
        goals: [
          createCharacterGoal("Hutao", { id: "hutao" }),
          createCharacterGoal("Yelan", { id: "added" }),
        ],
        selectedId: "added",
      }).json,
    );
    release(
      new Response(
        JSON.stringify({
          goals: [createCharacterGoal("Hutao", { id: "hutao" })],
        }),
        { status: 200 },
      ),
    );
    const first = await pending;
    assert.equal(
      first.state.goals.some((goal) => goal.id === "added"),
      true,
    );

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            goals: [createCharacterGoal("Hutao", { id: "hutao" })],
          }),
          { status: 200 },
        ),
    );
    const again = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(again.postCloud, true);
    assert.equal(
      again.state.goals.some((goal) => goal.id === "added"),
      true,
    );
  });

  it("keeps a star saved during a read when a later cloud list omits it", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "hutao")).json);

    let release!: (value: Response) => void;
    mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const pending = hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(captureGoals(goalsWithStarred("Hutao", "hutao")).json);
    release(
      new Response(
        JSON.stringify({ goals: goalsWith("Hutao", "hutao").goals }),
        { status: 200 },
      ),
    );
    const first = await pending;
    assert.equal(first.state.goals[0]?.starred, true);

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Hutao", "hutao").goals }),
          { status: 200 },
        ),
    );
    const again = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(again.postCloud, true);
    assert.equal(again.state.goals[0]?.id, "hutao");
    assert.equal(again.state.goals[0]?.starred, true);
  });

  it("does not post when the reconciled list cannot be stored", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "local")).json);
    const storage = globalThis.localStorage;
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key: string, value: string) => {
      if (key === CALCULATOR_GOALS_STORAGE_KEY) {
        throw new Error("full");
      }
      setItem(key, value);
    };
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Yelan", "cloud").goals }),
          { status: 200 },
        ),
    );
    const result = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(result.postCloud, false);
    assert.equal(result.syncError, "Sync failed (0) — goals not synced");
    assert.equal(result.state.goals[0]?.id, "local");
  });

  it("does not roll back a newer local write when the cloud save fails", async () => {
    installLocalStorage();
    const baseline = captureGoals(goalsWith("Hutao", "base"));
    writeGoalsLocal(baseline.json);
    let release!: (value: Response) => void;
    mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const pending = saveGoalsState({
      state: goalsWith("Yelan", "edited"),
      pendingRemoveIds: new Set(),
      savedSnapshot: baseline.json,
      cloud: true,
      userId: "account-a",
    });
    writeGoalsLocal(captureGoals(goalsWith("Furina", "newer")).json);
    release(new Response("nope", { status: 500 }));
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(readGoalsLocal().goals[0]?.id, "newer");
  });

  it("keeps a signed-in local save when the next cloud list omits it", async () => {
    installLocalStorage();
    const baseline = captureGoals(goalsWith("Hutao", "base"));
    writeGoalsLocal(baseline.json);
    const saved = await saveGoalsState({
      state: goalsWith("Yelan", "saved"),
      pendingRemoveIds: new Set(),
      savedSnapshot: baseline.json,
      cloud: false,
      userId: "account-a",
    });
    assert.equal(saved.ok, true);
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ goals: baseline.goals }), {
          status: 200,
        }),
    );
    const hydrated = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(hydrated.postCloud, true);
    assert.equal(
      hydrated.state.goals.some((goal) => goal.id === "saved"),
      true,
    );
  });

  it("does not drop another account's recovery when a no-row read is stale", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "b-base")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-b" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "b-edited")).json);

    let allowA = true;
    let release!: (value: Response) => void;
    mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const pending = hydrateGoalsState(true, {
      userId: "account-a",
      allowWrite: () => allowA,
    });
    allowA = false;
    release(new Response(JSON.stringify({ goals: null }), { status: 200 }));
    const stale = await pending;
    assert.equal(stale.postCloud, false);

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
          { status: 200 },
        ),
    );
    const merged = await hydrateGoalsState(true, { userId: "account-b" });
    assert.equal(
      merged.state.goals.some((goal) => goal.id === "b-edited"),
      true,
    );
  });

  it("keeps a newer recovery for the same user when an older save finishes", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "a-local")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "a-edited")).json);

    let releasePost!: (value: Response) => void;
    mock.method(globalThis, "fetch", (_url, init) => {
      if (init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          releasePost = resolve;
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
          { status: 200 },
        ),
      );
    });
    const saving = saveGoalsState({
      state: readGoalsLocal(),
      pendingRemoveIds: new Set(),
      savedSnapshot: captureGoals(readGoalsLocal()).json,
      cloud: true,
      userId: "account-a",
    });
    await hydrateGoalsState(true, { userId: "account-a" });
    releasePost(new Response("{}", { status: 200 }));
    const saved = await saving;
    assert.equal(saved.ok, true);

    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ goals: goalsWith("Xingqiu", "cloud").goals }),
          { status: 200 },
        ),
    );
    const merged = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(
      merged.state.goals.some((goal) => goal.id === "a-edited"),
      true,
    );
  });

  it("does not let an older cloud read replace a newer read that merged a save", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "hutao")).json);

    let releaseOlder!: (value: Response) => void;
    let releaseNewer!: (value: Response) => void;
    let calls = 0;
    mock.method(globalThis, "fetch", () => {
      calls += 1;
      return calls === 1
        ? new Promise<Response>((resolve) => {
            releaseOlder = resolve;
          })
        : new Promise<Response>((resolve) => {
            releaseNewer = resolve;
          });
    });

    const older = hydrateGoalsState(true, { userId: "account-a" });
    const newer = hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "saved")).json);

    releaseNewer(
      new Response(
        JSON.stringify({ goals: goalsWith("Furina", "fresh").goals }),
        { status: 200 },
      ),
    );
    const newerResult = await newer;
    assert.deepEqual(
      newerResult.state.goals.map((goal) => goal.id),
      ["fresh", "saved"],
    );

    releaseOlder(
      new Response(
        JSON.stringify({ goals: goalsWith("Xingqiu", "stale").goals }),
        { status: 200 },
      ),
    );
    const olderResult = await older;
    assert.deepEqual(
      olderResult.state.goals.map((goal) => goal.id),
      ["fresh", "saved"],
    );
    assert.deepEqual(
      readGoalsLocal().goals.map((goal) => goal.id),
      ["fresh", "saved"],
    );
  });

  it("merges a newer cloud read with the save after an older read applied", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "hutao")).json);

    let releaseOlder!: (value: Response) => void;
    let releaseNewer!: (value: Response) => void;
    let calls = 0;
    mock.method(globalThis, "fetch", () => {
      calls += 1;
      return calls === 1
        ? new Promise<Response>((resolve) => {
            releaseOlder = resolve;
          })
        : new Promise<Response>((resolve) => {
            releaseNewer = resolve;
          });
    });

    const older = hydrateGoalsState(true, { userId: "account-a" });
    const newer = hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(captureGoals(goalsWith("Yelan", "saved")).json);

    releaseOlder(
      new Response(
        JSON.stringify({ goals: goalsWith("Xingqiu", "stale").goals }),
        { status: 200 },
      ),
    );
    await older;
    releaseNewer(
      new Response(
        JSON.stringify({ goals: goalsWith("Furina", "fresh").goals }),
        { status: 200 },
      ),
    );
    const newerResult = await newer;

    assert.deepEqual(
      newerResult.state.goals.map((goal) => goal.id),
      ["fresh", "saved"],
    );
    assert.equal(
      readGoalsLocal().goals.some((goal) => goal.id === "stale"),
      false,
    );
  });

  it("keeps a recovered addition when an unrelated save lands during the next read", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "hutao")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(
      captureGoals({
        ...emptyGoalsState(),
        goals: [
          createCharacterGoal("Hutao", { id: "hutao" }),
          createCharacterGoal("Yelan", { id: "added" }),
        ],
        selectedId: "added",
      }).json,
    );
    mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            goals: [createCharacterGoal("Hutao", { id: "hutao" })],
          }),
          { status: 200 },
        ),
    );
    const merged = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(merged.cloudDirty, true);
    assert.equal(
      merged.state.goals.some((goal) => goal.id === "added"),
      true,
    );

    let release!: (value: Response) => void;
    mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const pending = hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(
      captureGoals({
        ...emptyGoalsState(),
        goals: [
          createCharacterGoal("Hutao", { id: "hutao" }),
          createCharacterGoal("Yelan", { id: "added" }),
          createCharacterGoal("Xingqiu", { id: "extra" }),
        ],
        selectedId: "extra",
      }).json,
    );
    release(
      new Response(
        JSON.stringify({
          goals: [createCharacterGoal("Hutao", { id: "hutao" })],
        }),
        { status: 200 },
      ),
    );
    const again = await pending;
    assert.equal(again.postCloud, true);
    assert.equal(again.cloudDirty, true);
    assert.equal(
      again.state.goals.some((goal) => goal.id === "added"),
      true,
    );
    assert.equal(
      again.state.goals.some((goal) => goal.id === "extra"),
      true,
    );
  });

  it("drops a recovered addition after the cloud has caught up and then removes it", async () => {
    installLocalStorage();
    writeGoalsLocal(captureGoals(goalsWith("Hutao", "hutao")).json);
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("nope", { status: 500 }),
    );
    await hydrateGoalsState(true, { userId: "account-a" });
    writeGoalsLocal(
      captureGoals({
        ...emptyGoalsState(),
        goals: [
          createCharacterGoal("Hutao", { id: "hutao" }),
          createCharacterGoal("Yelan", { id: "added" }),
        ],
        selectedId: "added",
      }).json,
    );

    const cloud = (ids: string[]) =>
      new Response(
        JSON.stringify({
          goals: ids.map((id) =>
            createCharacterGoal(id === "added" ? "Yelan" : "Hutao", { id }),
          ),
        }),
        { status: 200 },
      );
    mock.method(globalThis, "fetch", async () => cloud(["hutao"]));
    const kept = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(
      kept.state.goals.some((goal) => goal.id === "added"),
      true,
    );

    mock.method(globalThis, "fetch", async () => cloud(["hutao", "added"]));
    const caughtUp = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(caughtUp.cloudDirty, undefined);
    assert.equal(
      caughtUp.state.goals.some((goal) => goal.id === "added"),
      true,
    );

    mock.method(globalThis, "fetch", async () => cloud(["hutao"]));
    const removed = await hydrateGoalsState(true, { userId: "account-a" });
    assert.equal(
      removed.state.goals.some((goal) => goal.id === "added"),
      false,
    );
  });
});

describe("goals cloud read guards", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );

  afterEach(() => {
    if (originalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("accepts a signed-out read and a failed signed-in read", () => {
    assert.equal(
      acceptGoalsHydrationUser({
        readUserId: null,
        sessionPending: false,
        sessionUserId: null,
        postCloud: false,
        syncError: "",
      }),
      true,
    );
    assert.equal(
      acceptGoalsHydrationUser({
        readUserId: "account-a",
        sessionPending: false,
        sessionUserId: "account-a",
        postCloud: false,
        syncError: "Sync failed (500) — goals not synced",
      }),
      true,
    );
  });

  it("does not accept a signed-in read the visible session has not caught up to", () => {
    assert.equal(
      acceptGoalsHydrationUser({
        readUserId: "account-a",
        sessionPending: false,
        sessionUserId: null,
        postCloud: true,
        syncError: "",
      }),
      false,
    );
    assert.equal(
      acceptGoalsHydrationUser({
        readUserId: "account-a",
        sessionPending: true,
        sessionUserId: null,
        postCloud: true,
        syncError: "",
      }),
      false,
    );
    assert.equal(
      acceptGoalsHydrationUser({
        readUserId: "account-a",
        sessionPending: false,
        sessionUserId: "account-a",
        postCloud: false,
        syncError: "",
      }),
      false,
    );
  });

  it("treats a cloud apply as safe to replace and a local save as not", () => {
    installLocalStorage();
    const baseline = get(goalsLocalRevision);
    assert.equal(goalsRevisionAllowsCloudReplace(baseline, baseline), true);

    persistGoalsLocal(goalsWith("Furina", "fresh"));
    const applied = get(goalsLocalRevision);
    assert.equal(goalsRevisionAllowsCloudReplace(applied, baseline), true);

    writeGoalsLocal(captureGoals(goalsWith("Yelan", "saved")).json);
    const saved = get(goalsLocalRevision);
    assert.equal(goalsRevisionAllowsCloudReplace(saved, baseline), false);
  });
});
