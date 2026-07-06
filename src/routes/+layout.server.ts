/**
 * +layout.server.ts
 *
 * Runs on the server for every page render (SSR + subsequent navigations).
 * Fetches slow-changing data via /api/static, which is Cloudflare-edge-cached.
 *
 * Characters + mapping are fetched directly here (they're small and stable).
 * Version numbers and all-teams data come from the cached API route so the
 * server doesn't re-hit Supabase on every request.
 */

import type { LayoutServerLoad } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { charactersCache } from "$lib/server/cache";
import type { Tables } from "$lib/types/database.types";

type Character = Tables<"characters">;

export const load: LayoutServerLoad = async ({ fetch }) => {
  // ── Fetch static data from our own cached endpoint ──────────────────────
  // Using `fetch` (SvelteKit's enhanced fetch) so the request gets the
  // Cloudflare cache hit on subsequent loads.
  const staticRes = await fetch("/api/static");
  const staticData = staticRes.ok ? await staticRes.json() : null;

  // ── Fetch character data + mapping (cached 15 min — changes only on patch day) ─
  const characters = await charactersCache.getOrSet("characters", async () => {
    const { data } = await serverDb
      .from("characters")
      .select("*")
      .order("name", { ascending: true });
    return data ?? [];
  });

  const mapping = new Map<string, Character>();
  characters.forEach((c) => mapping.set(c.name_id, c));

  return {
    mapping,
    characters,
    // Pass version numbers to the client so stores.ts can call /api/teams
    // and /api/nearmiss without needing to re-fetch them.
    abyssVersionNumber: staticData?.latestAbyssVersion?.version_number ?? -1,
    stygianVersionNumber:
      staticData?.latestStygianVersion?.version_number ?? -1,
    // Pre-fetched all-teams data — the client can hydrate stores from this
    // without making an extra network request on first load.
    allTeamsAbyss: staticData?.allTeamsAbyss ?? [],
    allTeamsStygian: staticData?.allTeamsStygian ?? [],
    stygianEnemies: staticData?.stygianEnemies ?? {
      top: null,
      middle: null,
      bottom: null,
    },
    abyssEnemies: staticData?.abyssEnemies ?? {
      top: [],
      bottom: [],
      buffName: null,
      openTime: null,
    },
    stygianSchedule: staticData?.stygianSchedule ?? null,
  };
};
