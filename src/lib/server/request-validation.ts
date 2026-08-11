import { error } from "@sveltejs/kit";
import type { User } from "better-auth";
import { MAX_CALCULATOR_GOALS } from "$lib/calculator-goals";
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
    if (typeof item !== "object" || item === null) {
      throw error(400, "Invalid roster payload");
    }
    const keys = Object.keys(item);
    if (
      keys.length !== 2 ||
      !keys.includes("name_id") ||
      !keys.includes("isOwned")
    ) {
      throw error(400, "Invalid roster payload");
    }
    const { name_id, isOwned } = item as Record<string, unknown>;
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

function requireTalentLevels(value: unknown): {
  normal: number;
  skill: number;
  burst: number;
} {
  if (typeof value !== "object" || value === null) {
    throw error(400, "Invalid calculator goals payload");
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    !keys.includes("normal") ||
    !keys.includes("skill") ||
    !keys.includes("burst")
  ) {
    throw error(400, "Invalid calculator goals payload");
  }
  const { normal, skill, burst } = value as Record<string, unknown>;
  return {
    normal: requireNumberInRange(normal, 1, 10, "Invalid calculator goals payload"),
    skill: requireNumberInRange(skill, 1, 10, "Invalid calculator goals payload"),
    burst: requireNumberInRange(burst, 1, 10, "Invalid calculator goals payload"),
  };
}

function requireCharacterUpgradeConfig(value: unknown): {
  level: number;
  ascension: number;
  talents: { normal: number; skill: number; burst: number };
} {
  if (typeof value !== "object" || value === null) {
    throw error(400, "Invalid calculator goals payload");
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    !keys.includes("level") ||
    !keys.includes("ascension") ||
    !keys.includes("talents")
  ) {
    throw error(400, "Invalid calculator goals payload");
  }
  const { level, ascension, talents } = value as Record<string, unknown>;
  return {
    level: requireNumberInRange(level, 1, 90, "Invalid calculator goals payload"),
    ascension: requireNumberInRange(
      ascension,
      0,
      6,
      "Invalid calculator goals payload",
    ),
    talents: requireTalentLevels(talents),
  };
}

function requireWeaponUpgradeConfig(value: unknown): {
  level: number;
  ascension: number;
} {
  if (typeof value !== "object" || value === null) {
    throw error(400, "Invalid calculator goals payload");
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("level") ||
    !keys.includes("ascension")
  ) {
    throw error(400, "Invalid calculator goals payload");
  }
  const { level, ascension } = value as Record<string, unknown>;
  return {
    level: requireNumberInRange(level, 1, 90, "Invalid calculator goals payload"),
    ascension: requireNumberInRange(
      ascension,
      0,
      6,
      "Invalid calculator goals payload",
    ),
  };
}

/** Validate `{ goals: CalculatorGoal[] }` for `/api/calculator-goals`. */
export function requireCalculatorGoals(value: unknown): CalculatorGoal[] {
  if (!Array.isArray(value)) {
    throw error(400, "Invalid calculator goals payload");
  }
  if (value.length > MAX_CALCULATOR_GOALS) {
    throw error(
      400,
      `goals must have at most ${MAX_CALCULATOR_GOALS} entries`,
    );
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
      id.length > 64 ||
      seen.has(id)
    ) {
      throw error(400, "Invalid calculator goals payload");
    }
    seen.add(id);

    if (kind === "character") {
      const keys = Object.keys(row);
      if (
        keys.length !== 5 ||
        !keys.includes("id") ||
        !keys.includes("kind") ||
        !keys.includes("name_id") ||
        !keys.includes("start") ||
        !keys.includes("target")
      ) {
        throw error(400, "Invalid calculator goals payload");
      }
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
      const keys = Object.keys(row);
      if (
        keys.length !== 5 ||
        !keys.includes("id") ||
        !keys.includes("kind") ||
        !keys.includes("weapon_id") ||
        !keys.includes("start") ||
        !keys.includes("target")
      ) {
        throw error(400, "Invalid calculator goals payload");
      }
      const weapon_id = requireFiniteInteger(
        row.weapon_id,
        "Invalid calculator goals payload",
      );
      if (weapon_id <= 0) {
        throw error(400, "Invalid calculator goals payload");
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
