/**
 * Validator for the `/api/calculator-goals` payload: character and weapon
 * upgrade goals with bounded start/target configs and unique ids.
 */
import { error } from "@sveltejs/kit";
import {
  MAX_CALCULATOR_GOALS,
  MAX_GOAL_ID_LENGTH,
} from "#lib/calculator-goals.js";
import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "#lib/upgrade-costs.js";
import type { CalculatorGoal } from "#lib/types/calculator-goals.js";
import {
  requireCharacterNameId,
  requireExactKeys,
  requireFiniteInteger,
  requireIntegerInRange,
  requireKeys,
} from "#lib/server/validation/core.js";

const GOALS_PAYLOAD_ERROR = "Invalid calculator goals payload";

function requireTalentLevels(value: unknown): {
  normal: number;
  skill: number;
  burst: number;
} {
  const { normal, skill, burst } = requireExactKeys(
    value,
    ["normal", "skill", "burst"],
    GOALS_PAYLOAD_ERROR,
  );
  return {
    normal: requireIntegerInRange(normal, 1, MAX_TALENT, GOALS_PAYLOAD_ERROR),
    skill: requireIntegerInRange(skill, 1, MAX_TALENT, GOALS_PAYLOAD_ERROR),
    burst: requireIntegerInRange(burst, 1, MAX_TALENT, GOALS_PAYLOAD_ERROR),
  };
}

function requireCharacterUpgradeConfig(value: unknown): {
  level: number;
  ascension: number;
  talents: { normal: number; skill: number; burst: number };
} {
  const { level, ascension, talents } = requireExactKeys(
    value,
    ["level", "ascension", "talents"],
    GOALS_PAYLOAD_ERROR,
  );
  return {
    level: requireIntegerInRange(level, 1, MAX_LEVEL, GOALS_PAYLOAD_ERROR),
    ascension: requireIntegerInRange(
      ascension,
      0,
      MAX_ASCENSION,
      GOALS_PAYLOAD_ERROR,
    ),
    talents: requireTalentLevels(talents),
  };
}

function requireWeaponUpgradeConfig(value: unknown): {
  level: number;
  ascension: number;
} {
  const { level, ascension } = requireExactKeys(
    value,
    ["level", "ascension"],
    GOALS_PAYLOAD_ERROR,
  );
  return {
    level: requireIntegerInRange(level, 1, MAX_LEVEL, GOALS_PAYLOAD_ERROR),
    ascension: requireIntegerInRange(
      ascension,
      0,
      MAX_ASCENSION,
      GOALS_PAYLOAD_ERROR,
    ),
  };
}

function optionalStarred(
  row: Record<string, unknown>,
): { starred: true } | Record<string, never> {
  if (!("starred" in row)) return {};
  if (row.starred === true) return { starred: true };
  if (row.starred === false) return {};
  throw error(400, GOALS_PAYLOAD_ERROR);
}

/** Validate `{ goals: CalculatorGoal[] }` for `/api/calculator-goals`. */
export function requireCalculatorGoals(value: unknown): CalculatorGoal[] {
  if (!Array.isArray(value)) {
    throw error(400, "Invalid calculator goals payload");
  }
  if (value.length > MAX_CALCULATOR_GOALS) {
    throw error(400, `goals must have at most ${MAX_CALCULATOR_GOALS} entries`);
  }

  const seen = new Set<string>();
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw error(400, "Invalid calculator goals payload");
    }
    const row = item as Record<string, unknown>;
    const { id, kind } = row;
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > MAX_GOAL_ID_LENGTH ||
      seen.has(id)
    ) {
      throw error(400, GOALS_PAYLOAD_ERROR);
    }
    seen.add(id);

    if (kind === "character") {
      requireKeys(
        row,
        ["id", "kind", "name_id", "start", "target"],
        ["starred"],
        GOALS_PAYLOAD_ERROR,
      );
      const name_id = requireCharacterNameId(row.name_id);
      return {
        id,
        kind: "character",
        name_id,
        start: requireCharacterUpgradeConfig(row.start),
        target: requireCharacterUpgradeConfig(row.target),
        ...optionalStarred(row),
      };
    }

    if (kind === "weapon") {
      requireKeys(
        row,
        ["id", "kind", "weapon_id", "start", "target"],
        ["starred"],
        GOALS_PAYLOAD_ERROR,
      );
      const weapon_id = requireFiniteInteger(
        row.weapon_id,
        GOALS_PAYLOAD_ERROR,
      );
      if (weapon_id <= 0) {
        throw error(400, GOALS_PAYLOAD_ERROR);
      }
      return {
        id,
        kind: "weapon",
        weapon_id,
        start: requireWeaponUpgradeConfig(row.start),
        target: requireWeaponUpgradeConfig(row.target),
        ...optionalStarred(row),
      };
    }

    throw error(400, "Invalid calculator goals payload");
  });
}
