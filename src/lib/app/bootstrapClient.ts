/**
 * Client bootstrap after layout SSR.
 *
 * seedClientStores — sync, safe during SSR/hydration (versions + local roster).
 * bootstrapClient — onMount only: warm /api/static, sync /api/roster if logged in.
 * Owned teams stay lazy (Abyss / Stygian / Pulls call ensureTeamsOwned).
 */

import type { Character, CharacterOwned } from "$lib/definitions";
import { authClient } from "$lib/auth-client";
import {
  charactersOwned,
  charactersHydrated,
  initHasSavedRoster,
  setVersionNumbers,
  invalidateTeamsOwned,
  invalidateNearMissTeams,
  ensureStaticBoards,
} from "$lib/stores";
import { isNewCharacter } from "$lib/is-new-character";

type LayoutHydration = {
  characters: Character[];
  abyssVersionNumber: number;
  stygianVersionNumber: number;
};

type CachedOwnedEntry =
  | { name_id: unknown; isOwned?: unknown }
  | { id: unknown; isOwned?: unknown };

/**
 * Reads and validates the cached roster from localStorage.
 *
 * Things that can go wrong (and how we handle them):
 * - localStorage unavailable (privacy mode / blocked / SecurityError): return undefined
 * - missing key: return undefined
 * - invalid JSON: return undefined
 * - schema drift (old shape, missing fields, different id types): ignore invalid entries
 * - partial/corrupted writes or manual edits: ignore invalid entries
 *
 * Fallback behavior: if anything is off, we default to "owned" for all characters
 * to preserve the pre-cache UX.
 */
function readOwnedCache(): CachedOwnedEntry[] | undefined {
  let cachedJSON: string | null = null;
  try {
    cachedJSON = localStorage.getItem("charactersOwned");
  } catch {
    return undefined;
  }

  if (!cachedJSON) return undefined;

  try {
    const parsed = JSON.parse(cachedJSON);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (v): v is CachedOwnedEntry =>
        typeof v === "object" && v !== null && ("name_id" in v || "id" in v),
    );
  } catch {
    return undefined;
  }
}

function mergeOwnedFlags(
  characters: Character[],
  cachedOwned: CachedOwnedEntry[] | undefined,
): CharacterOwned[] {
  const defaultOwned = (c: Character): boolean => {
    // New characters (recently released) default to not owned — the user likely
    // doesn't have them yet. This prevents the roster from auto-assigning owned
    // for every new character that gets added to the DB.
    if (isNewCharacter(c.released_at)) return false;
    return true;
  };

  if (!cachedOwned) {
    return characters.map((c) => ({ ...c, isOwned: defaultOwned(c) }));
  }

  const normalized = cachedOwned.map((v) => ({
    name_id: "name_id" in v ? v.name_id : (v as { id: unknown; isOwned?: unknown }).id,
    isOwned: v.isOwned,
  }));

  return characters.map((c) => {
    const cached = normalized.find((x) => x.name_id === c.name_id);
    const isOwned =
      typeof cached?.isOwned === "boolean" ? cached.isOwned : defaultOwned(c);
    return { ...c, isOwned };
  });
}

async function loadDbRoster(
  characters: Character[],
): Promise<CharacterOwned[] | null> {
  try {
    const { data: session } = await authClient.getSession();
    if (!session) return null;

    const res = await fetch("/api/roster");
    if (!res.ok) return null;
    const { roster } = await res.json();
    if (!Array.isArray(roster)) return null;
    return mergeOwnedFlags(characters, roster);
  } catch {
    return null;
  }
}

/**
 * Client-side hydration from root layout SSR data.
 * Full allTeams* lists are warmed via ensureStaticBoards (not layout HTML).
 */
export function seedClientStores(data: LayoutHydration): void {
  setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber);

  initHasSavedRoster();

  const cachedOwned = readOwnedCache();
  const localRoster = mergeOwnedFlags(data.characters, cachedOwned);
  charactersOwned.set(localRoster);
  charactersHydrated.set(true);
}

/**
 * Seeds layout stores, syncs DB roster if logged in.
 * Owned teams + near-miss load lazily on Abyss / Stygian / Pulls.
 * Meta team boards warm in the background so home → abyss/stygian nav is snappy.
 */
export async function bootstrapClient(data: LayoutHydration): Promise<void> {
  seedClientStores(data);

  // Fire early — do not await; home stays interactive while boards warm.
  // Failures land in staticBoardsError for Abyss/Stygian retry UI.
  // Investment JSON is loaded on Teams / character routes (not every visit).
  void ensureStaticBoards();

  const dbRoster = await loadDbRoster(data.characters);

  // DB takes precedence — update store, sync localStorage, invalidate team caches
  if (dbRoster) {
    charactersOwned.set(dbRoster);
    try {
      localStorage.setItem("charactersOwned", JSON.stringify(dbRoster));
    } catch {}
    invalidateTeamsOwned();
    invalidateNearMissTeams();
  }
}
