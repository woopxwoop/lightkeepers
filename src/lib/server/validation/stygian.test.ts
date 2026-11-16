import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_ENEMY_IDS,
  MAX_TEAM_ENEMY_PAIRS,
  MAX_TEAM_KEY_LENGTH,
  requireAnalyticsMode,
  requireEnemyId,
  requireEnemyIds,
  requireStygianClearDifficulty,
  requireTeamEnemyPairs,
} from "./stygian.ts";
import { MAX_NAME_ID_LENGTH, requireCharacterNameId } from "./core.ts";

const isBadRequest = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === 400;

describe("stygian request validation", () => {
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

  it("requireEnemyId accepts positive integers and rejects junk", () => {
    assert.equal(requireEnemyId("42"), 42);
    assert.equal(requireEnemyId(7), 7);
    assert.throws(() => requireEnemyId("0"), isBadRequest);
    assert.throws(() => requireEnemyId("-1"), isBadRequest);
    assert.throws(() => requireEnemyId("1.5"), isBadRequest);
    assert.throws(() => requireEnemyId("abc"), isBadRequest);
    assert.throws(() => requireEnemyId(null), isBadRequest);
  });

  it("requireEnemyIds validates and dedupes", () => {
    assert.deepEqual(requireEnemyIds([1, 1, 2]), [1, 2]);
    assert.throws(() => requireEnemyIds([]), isBadRequest);
    assert.throws(() => requireEnemyIds([0]), isBadRequest);
    assert.throws(() => requireEnemyIds("nope"), isBadRequest);
    assert.throws(
      () =>
        requireEnemyIds(
          Array.from({ length: MAX_ENEMY_IDS + 1 }, (_, i) => i + 1),
        ),
      isBadRequest,
    );
  });

  it("requireStygianClearDifficulty defaults to Fearless", () => {
    assert.equal(requireStygianClearDifficulty(undefined), "Fearless");
    assert.equal(requireStygianClearDifficulty(null), "Fearless");
    assert.equal(requireStygianClearDifficulty("Dire"), "Dire");
    assert.throws(() => requireStygianClearDifficulty("Hard"), isBadRequest);
  });

  it("requireTeamEnemyPairs validates and dedupes pairs", () => {
    assert.deepEqual(
      requireTeamEnemyPairs([
        { team_key: "abc", enemy_id: 1 },
        { team_key: "abc", enemy_id: 1 },
        { team_key: "def", enemy_id: 2 },
      ]),
      [
        { team_key: "abc", enemy_id: 1 },
        { team_key: "def", enemy_id: 2 },
      ],
    );
    assert.throws(() => requireTeamEnemyPairs([]), isBadRequest);
    assert.throws(() => requireTeamEnemyPairs("nope"), isBadRequest);
    assert.throws(
      () => requireTeamEnemyPairs([{ team_key: "", enemy_id: 1 }]),
      isBadRequest,
    );
    assert.throws(
      () => requireTeamEnemyPairs([{ team_key: "a", enemy_id: 0 }]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireTeamEnemyPairs([{ team_key: "a", enemy_id: 1, extra: true }]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireTeamEnemyPairs([
          { team_key: "a".repeat(MAX_TEAM_KEY_LENGTH + 1), enemy_id: 1 },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireTeamEnemyPairs(
          Array.from({ length: MAX_TEAM_ENEMY_PAIRS + 1 }, (_, i) => ({
            team_key: `t${i}`,
            enemy_id: i + 1,
          })),
        ),
      isBadRequest,
    );
  });
});
