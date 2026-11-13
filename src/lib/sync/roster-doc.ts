/**
 * The roster as a synced document (design: docs/design/account-sync.md).
 *
 * Stored and sent: one entry per character the user configured
 * (`name_id`, owned flag, progress). The full character rows come from the
 * layout's catalog and are joined back in `rosterOwnedFrom`, so a catalog
 * change never rewrites the user's data.
 *
 * Merge: any conflict asks the user ("Use cloud" / "Upload this device").
 */

import type {
  Character,
  CharacterOwned,
  RosterProgress,
} from "#lib/definitions.js";
import { isBetaCharacter } from "#lib/is-beta-character.js";
import { isNewCharacter } from "#lib/is-new-character.js";
import { parseRosterProgress } from "#lib/roster-progress.js";
import { defineSyncedDocSpec } from "#lib/sync/synced-doc.js";

export type RosterEntry = {
  name_id: string;
  isOwned: boolean;
  progress: RosterProgress | null;
};

/** Sorted by `name_id`, one entry per character. Empty = never saved. */
export type RosterDoc = RosterEntry[];

function byNameId(a: RosterEntry, b: RosterEntry): number {
  return a.name_id < b.name_id ? -1 : a.name_id > b.name_id ? 1 : 0;
}

/**
 * Untrusted stored or server JSON → entries. Accepts the old cache shape
 * (full character rows, or `id` instead of `name_id`). Drops anything
 * without a name or an owned flag. Later duplicates win.
 */
export function parseRosterDoc(raw: unknown): RosterDoc {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, RosterEntry>();
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const nameId =
      typeof rec.name_id === "string"
        ? rec.name_id
        : typeof rec.id === "string"
          ? rec.id
          : null;
    if (!nameId || typeof rec.isOwned !== "boolean") continue;
    byId.set(nameId, {
      name_id: nameId,
      isOwned: rec.isOwned,
      progress: parseRosterProgress(rec.progress),
    });
  }
  return [...byId.values()].sort(byNameId);
}

/**
 * Entries for an edited roster (Settings save, GOOD import).
 *
 * `retained` is the stored document the edit started from. Rows whose
 * `name_id` is not in `owned` are characters the current catalog does not
 * show; the draft cannot edit them, so the save keeps their ownership and
 * progress. Catalog rows keep the draft's values.
 */
export function rosterDocOf(
  owned: CharacterOwned[],
  retained: RosterDoc = [],
): RosterDoc {
  const current = parseRosterDoc(owned);
  if (retained.length === 0) return current;
  const covered = new Set(current.map((entry) => entry.name_id));
  const kept = retained.filter((entry) => !covered.has(entry.name_id));
  if (kept.length === 0) return current;
  return [...current, ...kept].sort(byNameId);
}

/**
 * Characters the user never configured: recent releases and beta rows
 * default to not owned, everything else to owned.
 */
function defaultOwned(character: Character): boolean {
  if (isNewCharacter(character.released_at)) return false;
  if (isBetaCharacter(character.name_id, character.released_at)) return false;
  return true;
}

/** Catalog rows + stored entries → what roster pages read. */
export function rosterOwnedFrom(
  characters: Character[],
  doc: RosterDoc,
): CharacterOwned[] {
  const byId = new Map(doc.map((entry) => [entry.name_id, entry]));
  return characters.map((character) => {
    const entry = byId.get(character.name_id);
    return {
      ...character,
      isOwned: entry ? entry.isOwned : defaultOwned(character),
      progress: entry?.progress ?? null,
    };
  });
}

export const rosterDocSpec = defineSyncedDocSpec<RosterDoc>({
  key: "roster",
  endpoint: "/api/roster",
  field: "roster",
  schemaVersion: 1,
  empty: () => [],
  parse: parseRosterDoc,
  toWire: (doc) => doc,
  fromWire: (wire) => parseRosterDoc(wire),
  equal: (a, b) =>
    JSON.stringify(parseRosterDoc(a)) === JSON.stringify(parseRosterDoc(b)),
  merge: () => "ask",
});
