import { error } from "@sveltejs/kit";
import type { User } from "better-auth";

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
