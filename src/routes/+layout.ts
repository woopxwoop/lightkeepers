/**
 * +layout.ts
 *
 * Thin pass-through — the heavy lifting moved to +layout.server.ts.
 * This file keeps the `mapping` serialization that the client needs
 * (Maps don't survive JSON serialization, so we rebuild it here).
 */

import type { LayoutLoad } from "./$types";
import type { Tables } from "$lib/types/database.types";
import type { AbyssTeam, StygianTeam } from "$lib/definitions";

type Character = Tables<"characters">;

export const load: LayoutLoad = ({ data }) => {
  // Rebuild the Map from the plain object the server sends.
  // SvelteKit serializes Map → plain object on the wire; we restore it here.
  const mapping = new Map<string, Character>(
    data.mapping instanceof Map
      ? data.mapping
      : Object.entries(data.mapping ?? {}),
  );

  return {
    mapping,
    characters: data.characters as Character[],
    abyssVersionNumber: data.abyssVersionNumber as number,
    stygianVersionNumber: data.stygianVersionNumber as number,
    allTeamsAbyss: data.allTeamsAbyss as AbyssTeam[],
    allTeamsStygian: data.allTeamsStygian as StygianTeam[],
  };
};
