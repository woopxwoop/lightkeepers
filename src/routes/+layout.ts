/**
 * +layout.ts
 *
 * Rebuilds the name_id → character Map from the characters array (Maps do not
 * survive JSON serialization). Server ships characters once — no duplicate
 * `mapping` payload.
 */

import type { LayoutLoad } from "./$types";
import type { Tables } from "$lib/types/database.types";

type Character = Tables<"characters">;

export const load: LayoutLoad = ({ data }) => {
  const characters = data.characters as Character[];
  const mapping = new Map<string, Character>();
  for (const c of characters) {
    mapping.set(c.name_id, c);
  }

  return {
    mapping,
    characters,
    abyssVersionNumber: data.abyssVersionNumber as number,
    stygianVersionNumber: data.stygianVersionNumber as number,
    latestPatchNote: data.latestPatchNote,
  };
};
