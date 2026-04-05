/**
 * POST /api/teams
 *
 * Returns teams playable with the given character roster for both
 * Abyss and Stygian Onslaught.
 *
 * Body: { characters: string[]; abyssVersion: number; stygianVersion: number }
 *
 * Cache: in-memory LRU keyed by sorted character list + version numbers.
 * Rate limit: 60 requests / minute / IP.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import {
  rpcCache,
  apiRateLimiter,
  getClientIp,
  buildRpcKey,
} from "$lib/server/cache";

type TeamsBody = {
  characters: string[];
  abyssVersion: number;
  stygianVersion: number;
};

export const POST: RequestHandler = async ({ request }) => {
  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  if (!apiRateLimiter.check(ip)) {
    throw error(429, "Too many requests — please wait a moment.");
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: TeamsBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body.");
  }

  const { characters, abyssVersion, stygianVersion } = body;

  if (!Array.isArray(characters)) {
    throw error(400, "characters must be an array of strings.");
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const abyssKey = buildRpcKey("owned_abyss", abyssVersion, characters);
  const stygianKey = buildRpcKey("owned_stygian", stygianVersion, characters);

  const [abyssTeams, stygianTeams] = await Promise.all([
    rpcCache.getOrSet(abyssKey, async () => {
      const { data, error: err } = await serverDb.rpc(
        "get_teams_with_characters_subset",
        {
          p_character_names: characters,
          p_version_number: abyssVersion,
        },
      );
      if (err) throw new Error(err.message);
      return data ?? [];
    }),

    rpcCache.getOrSet(stygianKey, async () => {
      const { data, error: err } = await serverDb.rpc(
        "get_teams_with_characters_subset_stygian",
        {
          p_character_names: characters,
          p_version_number: stygianVersion,
        },
      );
      if (err) throw new Error(err.message);
      return data ?? [];
    }),
  ]);

  return json({ abyssTeams, stygianTeams });
};
