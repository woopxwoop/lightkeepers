/**
 * One-time move from the old single `calculatorGoals` key into slots.
 *
 * Run: pnpm exec tsx --test src/lib/app/goals-sync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { get } from "svelte/store";
import { createCharacterGoal, emptyGoalsState } from "../calculator-goals.ts";
import { goalsDocSpec } from "../sync/goals-doc.ts";
import { memorySlotStorage, retainUntilStored } from "../sync/storage.ts";
import { createSyncedDoc } from "../sync/synced-doc.ts";
import { migrateLegacyGoals } from "./goals-sync.ts";

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

  it("does nothing without old data", () => {
    const storage = memorySlotStorage();
    migrateLegacyGoals(storage);
    assert.equal(storage.entries.size, 0);
  });
});
