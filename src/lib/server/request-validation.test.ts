import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_NAME_ID_LENGTH,
  MAX_ROSTER_CHARACTERS,
  assertNoDbError,
  requireAnalyticsMode,
  requireCalculatorGoals,
  requireCharacterNameId,
  requireCharacterNameIds,
  requireEnemyId,
  requireFiniteInteger,
  requireIntegerInRange,
  requireJsonObject,
  requireNumberInRange,
  requireRosterEntries,
  requireUser,
} from "./request-validation.ts";
import {
  MAX_CALCULATOR_GOALS,
  MAX_GOAL_ID_LENGTH,
} from "../calculator-goals.ts";
import { createCharacterGoal, createWeaponGoal } from "../calculator-goals.ts";
import { MAX_TALENT } from "../upgrade-costs.ts";

const isBadRequest = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === 400;

const hasStatus =
  (status: number) =>
  (value: unknown): boolean =>
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === status;

describe("request validation", () => {
  it("accepts object JSON and rejects null, array, or malformed JSON", async () => {
    const body = await requireJsonObject(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
      }),
    );
    assert.equal(body.ok, true);

    await assert.rejects(
      requireJsonObject(
        new Request("http://localhost", { method: "POST", body: "null" }),
      ),
      isBadRequest,
    );
    await assert.rejects(
      requireJsonObject(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([1, 2]),
        }),
      ),
      isBadRequest,
    );
    await assert.rejects(
      requireJsonObject(
        new Request("http://localhost", { method: "POST", body: "{" }),
      ),
      isBadRequest,
    );
  });

  it("requires finite integers and bounded finite numbers", () => {
    assert.equal(requireFiniteInteger(3, "bad"), 3);
    assert.throws(() => requireFiniteInteger(3.5, "bad"), isBadRequest);
    assert.throws(() => requireFiniteInteger("3", "bad"), isBadRequest);
    assert.throws(() => requireFiniteInteger(Number.NaN, "bad"), isBadRequest);
    assert.throws(
      () => requireFiniteInteger(Number.POSITIVE_INFINITY, "bad"),
      isBadRequest,
    );

    assert.equal(requireNumberInRange(0.3, 0, 1, "bad"), 0.3);
    assert.equal(requireNumberInRange(0, 0, 1, "bad"), 0);
    assert.equal(requireNumberInRange(1, 0, 1, "bad"), 1);
    assert.throws(
      () => requireNumberInRange(Number.NaN, 0, 1, "bad"),
      isBadRequest,
    );
    assert.throws(() => requireNumberInRange(-0.1, 0, 1, "bad"), isBadRequest);
    assert.throws(() => requireNumberInRange(1.1, 0, 1, "bad"), isBadRequest);
    assert.throws(() => requireNumberInRange("0.3", 0, 1, "bad"), isBadRequest);

    assert.equal(requireIntegerInRange(3, 1, 10, "bad"), 3);
    assert.throws(() => requireIntegerInRange(3.5, 1, 10, "bad"), isBadRequest);
    assert.throws(() => requireIntegerInRange(0, 1, 10, "bad"), isBadRequest);
  });

  it("validates character name_id arrays", () => {
    assert.deepEqual(requireCharacterNameIds(["Furina"]), ["Furina"]);
    assert.throws(() => requireCharacterNameIds(null), isBadRequest);
    assert.throws(() => requireCharacterNameIds([""]), isBadRequest);
    assert.throws(
      () =>
        requireCharacterNameIds(
          Array.from({ length: MAX_ROSTER_CHARACTERS + 1 }, (_, i) => `c${i}`),
        ),
      isBadRequest,
    );
    assert.throws(
      () => requireCharacterNameIds(["x".repeat(MAX_NAME_ID_LENGTH + 1)]),
      isBadRequest,
    );
  });

  it("validates a single nameId and analytics mode", () => {
    assert.equal(requireCharacterNameId("Mualani"), "Mualani");
    assert.throws(() => requireCharacterNameId(null), isBadRequest);
    assert.throws(() => requireCharacterNameId(""), isBadRequest);
    assert.throws(
      () => requireCharacterNameId("x".repeat(MAX_NAME_ID_LENGTH + 1)),
      isBadRequest,
    );

    assert.equal(requireAnalyticsMode("abyss"), "abyss");
    assert.equal(requireAnalyticsMode("stygian"), "stygian");
    assert.throws(() => requireAnalyticsMode(null), isBadRequest);
    assert.throws(() => requireAnalyticsMode("simulated"), isBadRequest);
  });

  it("validates roster entries and rejects extra or wrong-typed keys", () => {
    assert.deepEqual(
      requireRosterEntries([{ name_id: "furina", isOwned: true }]),
      [{ name_id: "furina", isOwned: true }],
    );
    assert.throws(() => requireRosterEntries(null), isBadRequest);
    assert.throws(
      () => requireRosterEntries([{ name_id: "furina" }]),
      isBadRequest,
    );
    assert.throws(
      () => requireRosterEntries([{ name_id: "furina", isOwned: "yes" }]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireRosterEntries([{ name_id: "furina", isOwned: true, extra: 1 }]),
      isBadRequest,
    );
  });

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
  });

  it("requireUser returns the session user or 401", () => {
    const user = { id: "u1" } as App.Locals["user"];
    assert.equal(requireUser({ user, session: null }), user);
    assert.throws(
      () => requireUser({ user: null, session: null }),
      hasStatus(401),
    );
  });

  it("assertNoDbError ignores null and maps real errors to 500", () => {
    assert.doesNotThrow(() => assertNoDbError("test", null));
    assert.throws(
      () => assertNoDbError("test", new Error("db")),
      hasStatus(500),
    );
  });

  it("requireEnemyId accepts positive integers and rejects junk", () => {
    assert.equal(requireEnemyId("42"), 42);
    assert.equal(requireEnemyId(7), 7);
    assert.throws(() => requireEnemyId("0"), isBadRequest);
    assert.throws(() => requireEnemyId("-1"), isBadRequest);
    assert.throws(() => requireEnemyId("1.5"), isBadRequest);
    assert.throws(() => requireEnemyId("abc"), isBadRequest);
    assert.throws(() => requireEnemyId(null), isBadRequest);
  });
});
