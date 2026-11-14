/**
 * Validators for account-document writes (`baseRev`, account id checks) and
 * the `/api/roster` payload: roster entries with progress, plus the GOOD
 * weapon and artifact inventory slices.
 */
import { error } from "@sveltejs/kit";
import type {
  InventoryArtifact,
  InventorySubstat,
  InventoryWeapon,
  RosterProgress,
  RosterWeapon,
} from "#lib/definitions.js";
import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "#lib/upgrade-costs.js";
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
import {
  MAX_NAME_ID_LENGTH,
  MAX_ROSTER_CHARACTERS,
  requireExactKeys,
  requireIntegerInRange,
  requireKeys,
  requireNumberInRange,
} from "#lib/server/validation/core.js";

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
