/**
 * Validators for meta-analytics and Stygian routes: analytics mode, enemy ids,
 * team×enemy pairs for clear videos, and clear difficulty.
 */
import { error } from "@sveltejs/kit";
import {
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
  isStygianClearDifficulty,
  type StygianClearDifficulty,
} from "#lib/definitions.js";
import { requireFiniteInteger } from "#lib/server/validation/core.js";

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
    throw error(400, `enemyIds must have at most ${MAX_ENEMY_IDS} entries.`);
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
