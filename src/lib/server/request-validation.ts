import { error } from "@sveltejs/kit";

/** Soft cap — Genshin roster is ~100; leave headroom for future growth. */
export const MAX_ROSTER_CHARACTERS = 256;
export const MAX_NAME_ID_LENGTH = 64;

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
export function requireFiniteInteger(
  value: unknown,
  message: string,
): number {
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
