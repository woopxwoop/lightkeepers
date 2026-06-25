import type {
  AbyssTeam,
  Character,
  CharacterOwned,
  StygianTeam,
} from "$lib/definitions";
import {
  allTeamsAbyss,
  allTeamsStygian,
  charactersOwned,
  charactersHydrated,
  setVersionNumbers,
  writeNearMissTeams,
  writeTeamsOwned,
} from "$lib/stores";
import { get } from "svelte/store";

type LayoutHydration = {
  characters: Character[];
  abyssVersionNumber: number;
  stygianVersionNumber: number;
  allTeamsAbyss: AbyssTeam[];
  allTeamsStygian: StygianTeam[];
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
  if (!cachedOwned) {
    return characters.map((c) => ({ ...c, isOwned: true }));
  }

  const normalized = cachedOwned.map((v) => ({
    name_id: "name_id" in v ? v.name_id : (v as { id: unknown; isOwned?: unknown }).id,
    isOwned: v.isOwned,
  }));

  return characters.map((c) => {
    const cached = normalized.find((x) => x.name_id === c.name_id);
    const isOwned =
      typeof cached?.isOwned === "boolean" ? cached.isOwned : true;
    return { ...c, isOwned };
  });
}

async function loadDbRoster(
  characters: Character[],
): Promise<CharacterOwned[] | null> {
  try {
    const res = await fetch("/api/roster");
    if (!res.ok) return null; // 401 = not logged in, 500 = error
    const { roster } = await res.json();
    if (!Array.isArray(roster)) return null;
    return mergeOwnedFlags(characters, roster);
  } catch {
    return null;
  }
}

/**
 * Client-side hydration.
 * - Seeds slow-changing stores from SSR layout data (no extra fetch)
 * - Seeds roster from localStorage, then overlays DB roster if logged in
 * - Kicks off server calls for teams + near-miss in the background
 */
export function seedClientStores(data: LayoutHydration): void {
  setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber);
  allTeamsAbyss.set(data.allTeamsAbyss);
  allTeamsStygian.set(data.allTeamsStygian);

  const cachedOwned = readOwnedCache();
  const localRoster = mergeOwnedFlags(data.characters, cachedOwned);
  charactersOwned.set(localRoster);
  charactersHydrated.set(true);
}

export async function bootstrapClient(data: LayoutHydration): Promise<void> {
  seedClientStores(data);

  // Fetch teams and DB roster in parallel
  const [, dbRoster] = await Promise.all([
    writeTeamsOwned(get(charactersOwned)),
    loadDbRoster(data.characters),
  ]);

  // DB takes precedence — update store, sync localStorage, re-fetch teams
  if (dbRoster) {
    charactersOwned.set(dbRoster);
    try {
      localStorage.setItem("charactersOwned", JSON.stringify(dbRoster));
    } catch {}
    writeTeamsOwned(dbRoster).catch(console.error);
  }

  writeNearMissTeams(dbRoster ?? get(charactersOwned)).catch(console.error);
}
