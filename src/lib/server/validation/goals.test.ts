import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireCalculatorGoals } from "./goals.ts";
import {
  MAX_CALCULATOR_GOALS,
  MAX_GOAL_ID_LENGTH,
} from "../../planner/calculator-goals.ts";
import {
  createCharacterGoal,
  createWeaponGoal,
} from "../../planner/calculator-goals.ts";
import { MAX_TALENT } from "../../planner/upgrade-costs.ts";

const isBadRequest = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === 400;

describe("calculator goals request validation", () => {
  it("validates calculator goals and rejects extras / duplicates", () => {
    const char = createCharacterGoal("Hutao", { id: "a" });
    const weapon = createWeaponGoal(14501, { id: "b" });
    assert.deepEqual(requireCalculatorGoals([char, weapon]), [char, weapon]);

    assert.throws(() => requireCalculatorGoals(null), isBadRequest);
    assert.throws(
      () => requireCalculatorGoals([{ ...char, extra: true }]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          char,
          createCharacterGoal("Xingqiu", { id: "a" }),
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals(
          Array.from({ length: MAX_CALCULATOR_GOALS + 1 }, (_, i) =>
            createCharacterGoal("Hutao", { id: `g${i}` }),
          ),
        ),
      isBadRequest,
    );

    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            id: "a",
            kind: "character",
            name_id: "Hutao",
            start: char.start,
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            ...char,
            start: { ...char.start, level: 80.5 },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            ...char,
            start: { ...char.start, ascension: 1.5 },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            ...char,
            start: {
              ...char.start,
              talents: { ...char.start.talents, normal: MAX_TALENT + 1 },
            },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            ...char,
            start: {
              level: char.start.level,
              ascension: char.start.ascension,
            },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            ...char,
            start: {
              ...char.start,
              talents: { ...char.start.talents, skill: "9" },
            },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            id: "w0",
            kind: "weapon",
            weapon_id: 0,
            start: weapon.start,
            target: weapon.target,
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            id: "w-neg",
            kind: "weapon",
            weapon_id: -3,
            start: weapon.start,
            target: weapon.target,
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireCalculatorGoals([
          {
            ...char,
            id: "x".repeat(MAX_GOAL_ID_LENGTH + 1),
          },
        ]),
      isBadRequest,
    );

    const starred = createCharacterGoal("Hutao", { id: "s", starred: true });
    assert.deepEqual(requireCalculatorGoals([starred]), [starred]);
    assert.deepEqual(requireCalculatorGoals([{ ...char, starred: false }]), [
      char,
    ]);
    assert.throws(
      () => requireCalculatorGoals([{ ...char, starred: "yes" }]),
      isBadRequest,
    );
  });
});
