/**
 * One-time move from the old single `calculatorGoals` key into slots.
 *
 * Run: pnpm exec tsx --test src/lib/app/goals-sync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCharacterGoal, emptyGoalsState } from "../calculator-goals.ts";
import { memorySlotStorage } from "../sync/storage.ts";
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
      base: { goals: { id: string }[] } | null;
    };
    assert.deepEqual(
      slot.base?.goals.map((g) => g.id),
      ["g1", "g2"],
    );
  });

  it("keeps the old keys when the slot cannot be stored", () => {
    const storage = memorySlotStorage();
    storage.write("calculatorGoals", legacy);
    storage.failWrites = true;
    migrateLegacyGoals(storage);
    assert.equal(storage.read("lk:goals:guest"), null);
    assert.notEqual(storage.read("calculatorGoals"), null);
  });

  it("never overwrites an existing slot", () => {
    const storage = memorySlotStorage();
    storage.write("lk:goals:guest", { v: 1, data: emptyGoalsState() });
    storage.write("calculatorGoals", legacy);
    migrateLegacyGoals(storage);
    const slot = storage.read("lk:goals:guest") as Slot;
    assert.deepEqual(slot.data.goals, []);
  });

  it("does nothing without old data", () => {
    const storage = memorySlotStorage();
    migrateLegacyGoals(storage);
    assert.equal(storage.entries.size, 0);
  });
});
