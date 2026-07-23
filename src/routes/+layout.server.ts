/**
 * +layout.server.ts
 *
 * Runs on the server for every page render (SSR + subsequent navigations).
 * Version numbers come from tiny table lookups — not /api/static — so home
 * SSR is not blocked on the heavy all-teams RPCs. Full boards warm client-side
 * via ensureStaticBoards().
 */

import type { LayoutServerLoad } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { charactersCache } from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { e2eCharacters, e2eStaticPayload } from "$lib/e2e/fixtures";
import type { Tables } from "$lib/types/database.types";

type Character = Tables<"characters">;

export const load: LayoutServerLoad = async () => {
  const [versions, characters] = await Promise.all([
    (async () => {
      if (isPlaywrightE2e()) {
        const payload = e2eStaticPayload();
        return {
          abyssVersionNumber: payload.latestAbyssVersion.version_number,
          stygianVersionNumber: payload.latestStygianVersion.version_number,
        };
      }

      const [abyssVerRes, stygianVerRes] = await Promise.all([
        serverDb
          .from("abyss_versions")
          .select("version_number")
          .order("version_number", { ascending: false })
          .limit(1),
        serverDb
          .from("stygian_versions")
          .select("version_number")
          .order("version_number", { ascending: false })
          .limit(1),
      ]);

      if (abyssVerRes.error) {
        console.error("layout: abyss_versions error", abyssVerRes.error);
      }
      if (stygianVerRes.error) {
        console.error("layout: stygian_versions error", stygianVerRes.error);
      }

      return {
        abyssVersionNumber: abyssVerRes.data?.[0]?.version_number ?? -1,
        stygianVersionNumber: stygianVerRes.data?.[0]?.version_number ?? -1,
      };
    })(),
    charactersCache.getOrSet("characters", async () => {
      if (isPlaywrightE2e()) return e2eCharacters();
      const { data } = await serverDb
        .from("characters")
        .select("*")
        .order("name", { ascending: true });
      return data ?? [];
    }),
  ]);

  const mapping = new Map<string, Character>();
  characters.forEach((c) => mapping.set(c.name_id, c));

  return {
    mapping,
    characters,
    abyssVersionNumber: versions.abyssVersionNumber,
    stygianVersionNumber: versions.stygianVersionNumber,
  };
};
