import { error } from "@sveltejs/kit";
import type { User } from "better-auth";
import {
  MAX_CALCULATOR_GOALS,
  MAX_GOAL_ID_LENGTH,
} from "$lib/calculator-goals";
import {
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
  isStygianClearDifficulty,
  type StygianClearDifficulty,
} from "$lib/definitions";
import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "$lib/upgrade-costs";
import type { CalculatorGoal } from "$lib/types/calculator-goals";

/** Soft cap — Genshin roster is ~100; leave headroom for future growth. */
export const MAX_ROSTER_CHARACTERS = 256;
export const MAX_NAME_ID_LENGTH = 64;

/** Require a signed-in user; auth-gated rows are always scoped to this id. */
export function requireUser(locals: App.Locals): User {
  if (!locals.user) throw error(401, "Unauthorized");
  return locals.user;
}

/** Log the real PostgREST error, return a generic 500. */
export function assertNoDbError(label: string, err: unknown): void {
  if (!err) return;
  console.error(`${label} failed:`, err);
  throw error(500, "Internal server error");
}

/** Parse a request body and require a plain JSON object. */
export async function requireJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw error(400, "Invalid JSON body.");
  }
  return body as Record<string, unknown>;
}

/** Require a finite integer, using the caller's existing 400 response text. */
export function requireFiniteInteger(value: unknown, message: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw error(400, message);
  }
  return value;
}

/** Require a finite number inside an inclusive range. */
export function requireNumberInRange(
  value: unknown,
  min: number,
  max: number,
  message: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw error(400, message);
  }
  return value;
}

/** Require a finite integer inside an inclusive range. */
export function requireIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  message: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw error(400, message);
  }
  return value;
}

/** Require a plain object whose own keys are exactly `keys`. */
function requireExactKeys(
  value: unknown,
  keys: readonly string[],
  message: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw error(400, message);
  }
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    keys.some((key) => !actual.includes(key))
  ) {
    throw error(400, message);
  }
  return value as Record<string, unknown>;
}

/** Persisted roster entry accepted by `/api/roster`. */
export type RosterEntry = { name_id: string; isOwned: boolean };

/** Validate a `{ name_id, isOwned }[]` roster payload, rejecting extra keys. */
export function requireRosterEntries(value: unknown): RosterEntry[] {
  if (!Array.isArray(value)) {
    throw error(400, "Invalid roster payload");
  }
  if (value.length > MAX_ROSTER_CHARACTERS) {
    throw error(
      400,
      `roster must have at most ${MAX_ROSTER_CHARACTERS} entries`,
    );
  }
  return value.map((item) => {
    const { name_id, isOwned } = requireExactKeys(
      item,
      ["name_id", "isOwned"],
      "Invalid roster payload",
    );
    if (
      typeof name_id !== "string" ||
      name_id.length === 0 ||
      name_id.length > MAX_NAME_ID_LENGTH ||
      typeof isOwned !== "boolean"
    ) {
      throw error(400, "Invalid roster payload");
    }
    return { name_id, isOwned };
  });
}

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
      requireExactKeys(
        row,
        ["id", "kind", "name_id", "start", "target"],
        GOALS_PAYLOAD_ERROR,
      );
      const name_id = requireCharacterNameId(row.name_id);
      return {
        id,
        kind: "character",
        name_id,
        start: requireCharacterUpgradeConfig(row.start),
        target: requireCharacterUpgradeConfig(row.target),
      };
    }

    if (kind === "weapon") {
      requireExactKeys(
        row,
        ["id", "kind", "weapon_id", "start", "target"],
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
      };
    }

    throw error(400, "Invalid calculator goals payload");
  });
}

/** Validate a single character `name_id` (query param or body field). */
export function requireCharacterNameId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw error(400, "nameId must be a non-empty string.");
  }
  if (value.length > MAX_NAME_ID_LENGTH) {
    throw error(
      400,
      `nameId must be at most ${MAX_NAME_ID_LENGTH} characters.`,
    );
  }
  return value;
}

/** Abyss vs Stygian mode for public meta analytics. */
export function requireAnalyticsMode(value: unknown): "abyss" | "stygian" {
  if (value !== "abyss" && value !== "stygian") {
    throw error(400, "mode must be abyss or stygian.");
  }
  return value;
}

/** Positive integer enemy id from a query/path param. */
export function requireEnemyId(value: unknown): number {
  const raw =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number"
        ? String(value)
        : "";
  if (!/^\d+$/.test(raw)) {
    throw error(400, "enemyId must be a positive integer.");
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw error(400, "enemyId must be a positive integer.");
  }
  return id;
}

/** Validate a roster / owned-character name_id list for RPC routes. */
export function requireCharacterNameIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw error(400, "characters must be an array of strings.");
  }
  if (value.length > MAX_ROSTER_CHARACTERS) {
    throw error(
      400,
      `characters must have at most ${MAX_ROSTER_CHARACTERS} entries.`,
    );
  }
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      throw error(400, "characters must be an array of non-empty strings.");
    }
    if (item.length > MAX_NAME_ID_LENGTH) {
      throw error(
        400,
        `character name_id must be at most ${MAX_NAME_ID_LENGTH} characters.`,
      );
    }
  }
  return value as string[];
}

/** Soft cap — Stygian board needs 3; leave headroom for batching. */
export const MAX_TEAM_ENEMY_PAIRS = 12;
/** Soft cap for cheap-clears enemy id lists (board is 3). */
export const MAX_ENEMY_IDS = 8;
/** team_key is sha256 hex (64); allow a little headroom. */
export const MAX_TEAM_KEY_LENGTH = 128;

export type TeamEnemyPair = { team_key: string; enemy_id: number };

/** Validate `{ team_key, enemy_id }[]` for clear-video lookups. */
export function requireTeamEnemyPairs(value: unknown): TeamEnemyPair[] {
  if (!Array.isArray(value)) {
    throw error(400, "pairs must be an array.");
  }
  if (value.length === 0) {
    throw error(400, "pairs must not be empty.");
  }
  if (value.length > MAX_TEAM_ENEMY_PAIRS) {
    throw error(
      400,
      `pairs must have at most ${MAX_TEAM_ENEMY_PAIRS} entries.`,
    );
  }

  const out: TeamEnemyPair[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw error(400, "each pair must be an object.");
    }
    const rec = item as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (keys.length !== 2 || !("team_key" in rec) || !("enemy_id" in rec)) {
      throw error(400, "each pair must have exactly team_key and enemy_id.");
    }
    if (typeof rec.team_key !== "string" || rec.team_key.length === 0) {
      throw error(400, "team_key must be a non-empty string.");
    }
    if (rec.team_key.length > MAX_TEAM_KEY_LENGTH) {
      throw error(
        400,
        `team_key must be at most ${MAX_TEAM_KEY_LENGTH} characters.`,
      );
    }
    const enemyId = requireFiniteInteger(
      rec.enemy_id,
      "enemy_id must be a finite integer.",
    );
    if (!Number.isSafeInteger(enemyId) || enemyId <= 0) {
      throw error(400, "enemy_id must be a positive integer.");
    }
    const key = `${rec.team_key}|${enemyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ team_key: rec.team_key, enemy_id: enemyId });
  }
  return out;
}

/** Validate a non-empty list of positive enemy ids (cheap-clears board). */
export function requireEnemyIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw error(400, "enemyIds must be an array of positive integers.");
  }
  if (value.length === 0) {
    throw error(400, "enemyIds must not be empty.");
  }
  if (value.length > MAX_ENEMY_IDS) {
    throw error(
      400,
      `enemyIds must have at most ${MAX_ENEMY_IDS} entries.`,
    );
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const id = requireFiniteInteger(
      item,
      "enemyIds must be an array of positive integers.",
    );
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw error(400, "enemyIds must be an array of positive integers.");
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Fearless (default) or Dire — matches stygian.moe ingest labels. */
export function requireStygianClearDifficulty(
  value: unknown,
): StygianClearDifficulty {
  if (value === undefined || value === null) {
    return STYGIAN_CHEAP_CLEARS_DIFFICULTY;
  }
  if (!isStygianClearDifficulty(value)) {
    throw error(400, "difficulty must be Fearless or Dire.");
  }
  return value;
}
