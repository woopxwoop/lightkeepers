/**
 * +layout.server.ts
 *
 * Runs on the server for every page render (SSR + subsequent navigations).
 * Fetches slow-changing data via /api/static, which is Cloudflare-edge-cached
 * (and in-process LRU on the Node origin).
 *
 * Only version numbers ride in the root layout payload. Full team lists load
 * client-side via ensureStaticBoards(); enemy/schedule boards ride on abyss /
 * stygian page loads so home/settings/characters HTML stays lean.
 */

import type { LayoutServerLoad } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { charactersCache } from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { e2eCharacters } from "$lib/e2e/fixtures";
import type { Tables } from "$lib/types/database.types";

type Character = Tables<"characters">;

export const load: LayoutServerLoad = async ({ fetch }) => {
  const [staticRes, characters] = await Promise.all([
    fetch("/api/static"),
    charactersCache.getOrSet("characters", async () => {
      if (isPlaywrightE2e()) return e2eCharacters();
      const { data } = await serverDb
        .from("characters")
        .select("*")
        .order("name", { ascending: true });
      return data ?? [];
    }),
  ]);

  const staticData = staticRes.ok ? await staticRes.json() : null;

  const mapping = new Map<string, Character>();
  characters.forEach((c) => mapping.set(c.name_id, c));

  return {
    mapping,
    characters,
    abyssVersionNumber: staticData?.latestAbyssVersion?.version_number ?? -1,
    stygianVersionNumber:
      staticData?.latestStygianVersion?.version_number ?? -1,
  };
};
