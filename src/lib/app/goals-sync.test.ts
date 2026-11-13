/**
 * One-time move from the old single `calculatorGoals` key into slots.
 *
 * Run: pnpm exec tsx --test src/lib/app/goals-sync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { get } from "svelte/store";
import { createCharacterGoal, emptyGoalsState, MAX_CALCULATOR_GOALS } from "../calculator-goals.ts";
import { goalsDocSpec } from "../sync/goals-doc.ts";
import { memorySlotStorage, retainUntilStored } from "../sync/storage.ts";
import { createSyncedDoc } from "../sync/synced-doc.ts";
import { clearLegacyGoalsKeys, migrateLegacyGoals } from "./goals-sync.ts";

const legacy = {
  ...emptyGoalsState(),
  goals: [createCharacterGoal("Furina", { id: "g1" })],
  selectedId: "g1",
};

type Slot = { data: { goals: { id: string }[] }; dirty: boolean };

describe("migrateLegacyGoals", () => {
  it("moves unowned goals into the guest slot as already saved", () => {
    const storage = memorySlotStorage();
    storage.write("calculatorGoals", legacy);
    migrateLegacyGoals(storage);
    const slot = storage.read("lk:goals:guest") as Slot;
    assert.deepEqual(
      slot.data.goals.map((g) => g.id),
      ["g1"],
    );
    assert.equal(slot.dirty, false);
    assert.equal(storage.read("calculatorGoals"), null);
  });

  it("gives goals with unsent recovery edits to that account, unsent", () => {
    const storage = memorySlotStorage();
    storage.write("calculatorGoals", legacy);
    storage.write("calculatorGoalsRecovery", { userId: "u1", baseJson: "{}" });
    migrateLegacyGoals(storage);
    const slot = storage.read("lk:goals:u1") as Slot;
    assert.equal(slot.dirty, true);
    assert.equal(storage.read("lk:goals:guest"), null);
    assert.equal(storage.read("calculatorGoalsRecovery"), null);
  });

  it("keeps the recovery base so local deletes survive the first read", () => {
    const storage = memorySlotStorage();
    const base = {
      ...emptyGoalsState(),
      goals: [
        createCharacterGoal("Furina", { id: "g1" }),
        createCharacterGoal("Neuvillette", { id: "g2" }),
      ],
    };
    storage.write("calculatorGoals", legacy);
    storage.write("calculatorGoalsRecovery", {
      userId: "u1",
      baseJson: JSON.stringify(base),
    });
    migrateLegacyGoals(storage);
    const slot = storage.read("lk:goals:u1") as Slot & {
      server: { state: string; base?: { goals: { id: string }[] } };
    };
    assert.equal(slot.server.state, "detached");
    assert.deepEqual(
      slot.server.base?.goals.map((g) => g.id),
      ["g1", "g2"],
    );
  });

  it("keeps the old keys when the slot cannot be stored", () => {
    const storage = memorySlotStorage();
    storage.write("calculatorGoals", legacy);
    storage.failWrites = true;
    const pending = migrateLegacyGoals(storage);
    assert.equal(pending?.key, "lk:goals:guest");
    assert.equal(storage.read("lk:goals:guest"), null);
    assert.notEqual(storage.read("calculatorGoals"), null);
  });

  it("shows the unstored goals so a later save does not replace them with empty", async () => {
    const storage = memorySlotStorage();
    storage.write("calculatorGoals", legacy);
    storage.failWrites = true;
    const pending = migrateLegacyGoals(storage);
    assert.ok(pending);
    const doc = createSyncedDoc(goalsDocSpec, {
      storage: retainUntilStored(storage, pending.key, pending.slot),
      transport: {
        read: async () => ({ status: "error", message: "unavailable" }),
        write: async () => ({ status: "error", message: "unavailable" }),
        remove: async () => ({ status: "error", message: "unavailable" }),
      },
    });
    doc.setAccount(null);
    assert.equal(get(doc.view).data.goals[0]?.id, "g1");
    assert.equal(storage.read("lk:goals:guest"), null);
    storage.failWrites = false;
    await doc.commit(get(doc.view).data);
    assert.equal(
      (storage.read("lk:goals:guest") as Slot).data.goals[0]?.id,
      "g1",
    );
    migrateLegacyGoals(storage);
    assert.equal(storage.read("calculatorGoals"), null);
    assert.equal(
      (storage.read("lk:goals:guest") as Slot).data.goals[0]?.id,
      "g1",
    );
    doc.dispose();
  });

  it("adds legacy goals an existing slot does not already contain", () => {
    const storage = memorySlotStorage();
    storage.write("lk:goals:guest", {
      v: 1,
      data: {
        ...emptyGoalsState(),
        goals: [createCharacterGoal("Zhongli", { id: "keep" })],
      },
    });
    storage.write("calculatorGoals", legacy);
    migrateLegacyGoals(storage);
    const slot = storage.read("lk:goals:guest") as Slot;
    assert.deepEqual(
      slot.data.goals.map((goal) => goal.id),
      ["keep", "g1"],
    );
    assert.equal(storage.read("calculatorGoals"), null);
  });

  it("keeps the legacy keys when the existing slot cannot store the merge", () => {
    const storage = memorySlotStorage();
    storage.write("lk:goals:guest", { v: 1, data: emptyGoalsState() });
    storage.write("calculatorGoals", legacy);
    storage.failWrites = true;
    const pending = migrateLegacyGoals(storage);
    assert.equal(pending?.key, "lk:goals:guest");
    assert.notEqual(storage.read("calculatorGoals"), null);
    assert.deepEqual(
      (storage.read("lk:goals:guest") as Slot).data.goals,
      [],
    );
  });

  it("serves a failed merge and keeps legacy keys until that merge is stored", () => {
    const storage = memorySlotStorage();
    const existing = {
      v: 1,
      data: emptyGoalsState(),
      dirty: false,
      server: { state: "unseen" },
    };
    storage.write("lk:goals:guest", existing);
    storage.write("calculatorGoals", legacy);
    storage.failWrites = true;
    const pending = migrateLegacyGoals(storage);
    assert.ok(pending);
    storage.failWrites = false;
    const wrapped = retainUntilStored(storage, pending.key, pending.slot, () =>
      clearLegacyGoalsKeys(storage),
    );
    assert.equal(wrapped.write(pending.key, existing), true);
    assert.equal(
      (storage.read("calculatorGoals") as typeof legacy).goals[0]?.id,
      "g1",
    );
    const shown = wrapped.read(pending.key) as Slot;
    assert.deepEqual(
      shown.data.goals.map((goal) => goal.id),
      ["g1"],
    );
    assert.equal(wrapped.write(pending.key, shown), true);
    assert.equal(storage.read("calculatorGoals"), null);
    assert.deepEqual(
      (storage.read("lk:goals:guest") as Slot).data.goals.map((goal) => goal.id),
      ["g1"],
    );
  });

  it("asks when legacy goals do not fit beside a full slot", async () => {
    const storage = memorySlotStorage();
    const goals = Array.from({ length: MAX_CALCULATOR_GOALS }, (_, i) =>
      createCharacterGoal("Zhongli", { id: `full-${i}` }),
    );
    storage.write("lk:goals:guest", {
      v: 1,
      data: { ...emptyGoalsState(), goals, selectedId: goals[0]?.id ?? null },
    });
    storage.write("calculatorGoals", legacy);
    assert.equal(migrateLegacyGoals(storage), null);
    // The question holds the legacy goals, so the old keys are done.
    assert.equal(storage.read("calculatorGoals"), null);
    const doc = createSyncedDoc(goalsDocSpec, {
      storage,
      transport: {
        read: async () => ({ status: "error", message: "unavailable" }),
        write: async () => ({ status: "error", message: "unavailable" }),
        remove: async () => ({ status: "error", message: "unavailable" }),
      },
    });
    doc.setAccount(null);
    const view = () => get(doc.view);
    assert.equal(view().status, "ask");
    assert.equal(view().remoteSource, "device");
    assert.equal(view().data.goals.length, MAX_CALCULATOR_GOALS);
    assert.deepEqual(
      view().remote?.goals.map((goal) => goal.id),
      ["g1"],
    );
    // Saving the full list unchanged leaves the question open.
    const again = await doc.commit(view().data, { basedOn: view().data });
    assert.equal(again.status, "ask");
    await doc.resolve("remote");
    assert.deepEqual(
      view().data.goals.map((goal) => goal.id),
      ["g1"],
    );
    // A later empty save does not bring the legacy goals back.
    await doc.commit(emptyGoalsState());
    migrateLegacyGoals(storage);
    assert.deepEqual((storage.read("lk:goals:guest") as Slot).data.goals, []);
    doc.dispose();
  });

  it("does nothing without old data", () => {
    const storage = memorySlotStorage();
    migrateLegacyGoals(storage);
    assert.equal(storage.entries.size, 0);
  });
});
