import { error } from "@sveltejs/kit";
import type { User } from "better-auth";
import {
  MAX_CALCULATOR_GOALS,
  MAX_GOAL_ID_LENGTH,
} from "#lib/calculator-goals.js";
import {
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
  isStygianClearDifficulty,
  type InventoryArtifact,
  type InventorySubstat,
  type InventoryWeapon,
  type RosterProgress,
  type RosterWeapon,
  type StygianClearDifficulty,
} from "#lib/definitions.js";
import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "#lib/upgrade-costs.js";
import type { CalculatorGoal } from "#lib/types/calculator-goals.js";
import type {
  ResearchAnswerStyle,
  ResearchLlmProvider,
  ResearchQuestionKind,
  ResearchRequest,
} from "#lib/research-types.js";
import {
  MAX_CONSTELLATION,
  MAX_REFINEMENT,
  MAX_WEAPON_KEY_LENGTH,
} from "#lib/roster-progress.js";
import {
  isArtifactSlot,
  MAX_ARTIFACT_LEVEL,
  MAX_ARTIFACT_SUBSTATS,
  MAX_ARTIFACT_TOTAL_ROLLS,
  MAX_GOOD_KEY_LENGTH,
  MAX_INVENTORY_ARTIFACTS,
  MAX_INVENTORY_WEAPONS,
  MAX_STAT_KEY_LENGTH,
  MAX_SUBSTAT_INPUT_ROWS,
  MAX_UNACTIVATED_SUBSTATS,
} from "#lib/roster-inventory.js";

/** Soft cap — Genshin roster is ~100; leave headroom for future growth. */
export const MAX_ROSTER_CHARACTERS = 256;
export const MAX_NAME_ID_LENGTH = 64;

/** Require a signed-in user; auth-gated rows are always scoped to this id. */
export function requireUser(locals: App.Locals): User {
  if (!locals.user) throw error(401, "Unauthorized");
  return locals.user;
}

/**
 * Log the real PostgREST error, return a generic 500. An assertion so callers
 * keep narrowing: after `assertNoDbError(label, res.error)`, `res.data` is set.
 */
export function assertNoDbError<E>(
  label: string,
  err: E,
): asserts err is Extract<E, null | undefined> {
  if (!err) return;
  console.error(`${label} failed:`, err);
  throw error(500, "Internal server error");
}

/** Longer than any timestamptz text; anything past it is not a revision. */
const MAX_BASE_REV_LENGTH = 64;

/**
 * Optional `baseRev` on an account-document POST (see `account-doc.ts`).
 * Absent → `undefined` (legacy write), `null` → create only, otherwise a
 * parseable timestamp string the client got back as `rev`.
 */
export function requireBaseRev(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_BASE_REV_LENGTH ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw error(400, "baseRev must be a revision string or null.");
  }
  return value;
}

/**
 * Optional `account` on an account-document POST: the user id the client
 * stored this data for. A different signed-in user means the cookie changed
 * after the client chose to write, so the write is refused.
 */
export function requireExpectedAccount(value: unknown, userId: string): void {
  if (value === undefined) return;
  if (value !== userId) throw error(403, "Signed-in account changed.");
}

/** DELETE must name the account. A missing or different id is refused. */
export function requireMatchingAccount(value: unknown, userId: string): void {
  if (value !== userId) throw error(403, "Signed-in account changed.");
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
  return requireKeys(value, keys, [], message);
}

/** Require `required` keys; ignore unknown extras (GOOD producers add `id`, etc.). */
function pickKnownKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  message: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw error(400, message);
  }
  const row = value as Record<string, unknown>;
  const actual = Object.keys(row);
  if (required.some((key) => !actual.includes(key))) {
    throw error(400, message);
  }
  const allowed = new Set([...required, ...optional]);
  const picked: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in row) picked[key] = row[key];
  }
  return picked;
}

/** Require `required` keys; each other own key must be in `optional`. */
function requireKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  message: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw error(400, message);
  }
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value);
  if (required.some((key) => !actual.includes(key))) {
    throw error(400, message);
  }
  if (actual.some((key) => !allowed.has(key))) {
    throw error(400, message);
  }
  return value as Record<string, unknown>;
}

/** Persisted roster entry accepted by `/api/roster`. */
export type RosterEntry = {
  name_id: string;
  isOwned: boolean;
  progress?: RosterProgress | null;
};

const ROSTER_PAYLOAD_ERROR = "Invalid roster payload";

function requireRosterWeapon(value: unknown): RosterWeapon {
  const { key, level, ascension, refinement } = requireExactKeys(
    value,
    ["key", "level", "ascension", "refinement"],
    ROSTER_PAYLOAD_ERROR,
  );
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.length > MAX_WEAPON_KEY_LENGTH
  ) {
    throw error(400, ROSTER_PAYLOAD_ERROR);
  }
  return {
    key,
    level: requireIntegerInRange(level, 1, MAX_LEVEL, ROSTER_PAYLOAD_ERROR),
    ascension: requireIntegerInRange(
      ascension,
      0,
      MAX_ASCENSION,
      ROSTER_PAYLOAD_ERROR,
    ),
    refinement: requireIntegerInRange(
      refinement,
      1,
      MAX_REFINEMENT,
      ROSTER_PAYLOAD_ERROR,
    ),
  };
}

function requireRosterProgress(value: unknown): RosterProgress {
  const { level, ascension, constellation, talents, weapon } = requireExactKeys(
    value,
    ["level", "ascension", "constellation", "talents", "weapon"],
    ROSTER_PAYLOAD_ERROR,
  );
  const parsedTalents = requireExactKeys(
    talents,
    ["normal", "skill", "burst"],
    ROSTER_PAYLOAD_ERROR,
  );
  return {
    level: requireIntegerInRange(level, 1, MAX_LEVEL, ROSTER_PAYLOAD_ERROR),
    ascension: requireIntegerInRange(
      ascension,
      0,
      MAX_ASCENSION,
      ROSTER_PAYLOAD_ERROR,
    ),
    constellation: requireIntegerInRange(
      constellation,
      0,
      MAX_CONSTELLATION,
      ROSTER_PAYLOAD_ERROR,
    ),
    talents: {
      normal: requireIntegerInRange(
        parsedTalents.normal,
        1,
        MAX_TALENT,
        ROSTER_PAYLOAD_ERROR,
      ),
      skill: requireIntegerInRange(
        parsedTalents.skill,
        1,
        MAX_TALENT,
        ROSTER_PAYLOAD_ERROR,
      ),
      burst: requireIntegerInRange(
        parsedTalents.burst,
        1,
        MAX_TALENT,
        ROSTER_PAYLOAD_ERROR,
      ),
    },
    weapon: weapon == null ? null : requireRosterWeapon(weapon),
  };
}

/** Validate a `{ name_id, isOwned, progress? }[]` roster payload. */
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
    const { name_id, isOwned, progress } = requireKeys(
      item,
      ["name_id", "isOwned"],
      ["progress"],
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
    const entry: RosterEntry = { name_id, isOwned };
    if (progress !== undefined) {
      entry.progress =
        progress == null ? null : requireRosterProgress(progress);
    }
    return entry;
  });
}

const INVENTORY_PAYLOAD_ERROR = "Invalid inventory payload";

function requireInventoryLocation(value: unknown): string {
  if (value === "") return "";
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_GOOD_KEY_LENGTH
  ) {
    throw error(400, INVENTORY_PAYLOAD_ERROR);
  }
  return value;
}

function requireInventoryKey(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw error(400, INVENTORY_PAYLOAD_ERROR);
  }
  return value;
}

function isEmptySubstatPlaceholder(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  // Only explicit empty-string keys are GO placeholders; missing key is invalid.
  return (value as Record<string, unknown>).key === "";
}

function requireInventorySubstat(value: unknown): InventorySubstat {
  const {
    key,
    value: roll,
    initialValue,
  } = pickKnownKeys(
    value,
    ["key", "value"],
    ["initialValue"],
    INVENTORY_PAYLOAD_ERROR,
  );
  const parsed: InventorySubstat = {
    key: requireInventoryKey(key, MAX_STAT_KEY_LENGTH),
    // Flat HP/ATK/DEF rolls are thousands; crit/EM stay small.
    value: requireNumberInRange(roll, -1e6, 1e6, INVENTORY_PAYLOAD_ERROR),
  };
  if (initialValue !== undefined) {
    parsed.initialValue = requireNumberInRange(
      initialValue,
      -1e6,
      1e6,
      INVENTORY_PAYLOAD_ERROR,
    );
  }
  return parsed;
}

function requireInventorySubstats(
  value: unknown,
  max: number,
): InventorySubstat[] {
  if (!Array.isArray(value) || value.length > MAX_SUBSTAT_INPUT_ROWS) {
    throw error(400, INVENTORY_PAYLOAD_ERROR);
  }
  const rows = value
    .filter((row) => !isEmptySubstatPlaceholder(row))
    .map(requireInventorySubstat);
  if (rows.length > max) {
    throw error(400, INVENTORY_PAYLOAD_ERROR);
  }
  return rows;
}

/** Validate a GOOD `IWeapon[]` inventory slice. */
export function requireInventoryWeapons(value: unknown): InventoryWeapon[] {
  if (!Array.isArray(value)) {
    throw error(400, INVENTORY_PAYLOAD_ERROR);
  }
  if (value.length > MAX_INVENTORY_WEAPONS) {
    throw error(
      400,
      `weapons must have at most ${MAX_INVENTORY_WEAPONS} entries`,
    );
  }
  return value.map((item) => {
    const { key, level, ascension, refinement, location, lock } = pickKnownKeys(
      item,
      ["key", "level", "ascension", "refinement", "location", "lock"],
      [],
      INVENTORY_PAYLOAD_ERROR,
    );
    if (typeof lock !== "boolean") {
      throw error(400, INVENTORY_PAYLOAD_ERROR);
    }
    return {
      key: requireInventoryKey(key, MAX_WEAPON_KEY_LENGTH),
      level: requireIntegerInRange(
        level,
        1,
        MAX_LEVEL,
        INVENTORY_PAYLOAD_ERROR,
      ),
      ascension: requireIntegerInRange(
        ascension,
        0,
        MAX_ASCENSION,
        INVENTORY_PAYLOAD_ERROR,
      ),
      refinement: requireIntegerInRange(
        refinement,
        1,
        MAX_REFINEMENT,
        INVENTORY_PAYLOAD_ERROR,
      ),
      location: requireInventoryLocation(location),
      lock,
    };
  });
}

/** Validate a GOOD `IArtifact[]` inventory slice. */
export function requireInventoryArtifacts(value: unknown): InventoryArtifact[] {
  if (!Array.isArray(value)) {
    throw error(400, INVENTORY_PAYLOAD_ERROR);
  }
  if (value.length > MAX_INVENTORY_ARTIFACTS) {
    throw error(
      400,
      `artifacts must have at most ${MAX_INVENTORY_ARTIFACTS} entries`,
    );
  }
  return value.map((item) => {
    const {
      setKey,
      slotKey,
      level,
      rarity,
      mainStatKey,
      location,
      lock,
      substats,
      totalRolls,
      astralMark,
      elixirCrafted,
      unactivatedSubstats,
    } = pickKnownKeys(
      item,
      [
        "setKey",
        "slotKey",
        "level",
        "rarity",
        "mainStatKey",
        "location",
        "lock",
        "substats",
      ],
      ["totalRolls", "astralMark", "elixirCrafted", "unactivatedSubstats"],
      INVENTORY_PAYLOAD_ERROR,
    );
    if (typeof lock !== "boolean" || !isArtifactSlot(slotKey)) {
      throw error(400, INVENTORY_PAYLOAD_ERROR);
    }
    const parsed: InventoryArtifact = {
      setKey: requireInventoryKey(setKey, MAX_GOOD_KEY_LENGTH),
      slotKey,
      level: requireIntegerInRange(
        level,
        0,
        MAX_ARTIFACT_LEVEL,
        INVENTORY_PAYLOAD_ERROR,
      ),
      rarity: requireIntegerInRange(rarity, 1, 5, INVENTORY_PAYLOAD_ERROR),
      mainStatKey: requireInventoryKey(mainStatKey, MAX_STAT_KEY_LENGTH),
      location: requireInventoryLocation(location),
      lock,
      substats: requireInventorySubstats(substats, MAX_ARTIFACT_SUBSTATS),
    };
    if (totalRolls !== undefined) {
      parsed.totalRolls = requireIntegerInRange(
        totalRolls,
        0,
        MAX_ARTIFACT_TOTAL_ROLLS,
        INVENTORY_PAYLOAD_ERROR,
      );
    }
    if (astralMark !== undefined) {
      if (typeof astralMark !== "boolean") {
        throw error(400, INVENTORY_PAYLOAD_ERROR);
      }
      parsed.astralMark = astralMark;
    }
    if (elixirCrafted !== undefined) {
      if (typeof elixirCrafted !== "boolean") {
        throw error(400, INVENTORY_PAYLOAD_ERROR);
      }
      parsed.elixirCrafted = elixirCrafted;
    }
    if (unactivatedSubstats !== undefined) {
      const unactivated = requireInventorySubstats(
        unactivatedSubstats,
        MAX_UNACTIVATED_SUBSTATS,
      );
      if (unactivated.length > 0) parsed.unactivatedSubstats = unactivated;
    }
    return parsed;
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

export const MAX_RESEARCH_QUESTION_LENGTH = 2000;
export const MAX_RESEARCH_FOCUS_IDS = 8;

const RESEARCH_QUESTION_KINDS = [
  "how_to_play",
  "ask",
] as const satisfies readonly ResearchQuestionKind[];
const RESEARCH_LLM_PROVIDERS = [
  "gemini",
  "deepseek",
] as const satisfies readonly ResearchLlmProvider[];
const RESEARCH_MODES = [
  "abyss",
  "stygian",
] as const satisfies readonly NonNullable<ResearchRequest["mode"]>[];
const RESEARCH_ANSWER_STYLES = [
  "concise",
  "normal",
  "verbose",
] as const satisfies readonly ResearchAnswerStyle[];

/** Absent → `undefined`; otherwise one of `allowed` or 400. */
function optionalOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw error(400, message);
  return value as T;
}

function requireResearchFocusNameIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw error(400, "focus_name_ids must be an array.");
  }
  if (value.length > MAX_RESEARCH_FOCUS_IDS) {
    throw error(
      400,
      `focus_name_ids must have at most ${MAX_RESEARCH_FOCUS_IDS} entries.`,
    );
  }
  return value.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
}

/** Validated `/api/research` body; only fields the agent should receive. */
export function requireResearchRequest(
  body: Record<string, unknown>,
): ResearchRequest {
  const topic = body.topic === "build" ? "build" : undefined;
  const focus_name_ids = requireResearchFocusNameIds(body.focus_name_ids);
  if (topic === "build" && focus_name_ids.length === 0) {
    throw error(400, "topic=build requires focus_name_ids.");
  }

  const asked = typeof body.question === "string" ? body.question.trim() : "";
  if (asked.length > MAX_RESEARCH_QUESTION_LENGTH) {
    throw error(
      400,
      `question must be at most ${MAX_RESEARCH_QUESTION_LENGTH} characters.`,
    );
  }
  const question =
    asked ||
    (topic === "build" ? `How should I build ${focus_name_ids[0]}?` : "");
  if (!question) throw error(400, "question is required.");

  const question_kind =
    topic === "build"
      ? "ask"
      : (optionalOneOf(
          body.question_kind,
          RESEARCH_QUESTION_KINDS,
          "question_kind must be how_to_play or ask.",
        ) ?? "ask");

  return {
    topic,
    question_kind,
    question,
    focus_name_ids,
    llm_provider: optionalOneOf(
      body.llm_provider,
      RESEARCH_LLM_PROVIDERS,
      "llm_provider must be gemini or deepseek.",
    ),
    mode: optionalOneOf(
      body.mode,
      RESEARCH_MODES,
      "mode must be abyss or stygian.",
    ),
    answer_style: optionalOneOf(
      body.answer_style,
      RESEARCH_ANSWER_STYLES,
      "answer_style must be concise, normal, or verbose.",
    ),
  };
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
