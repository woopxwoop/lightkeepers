/**
 * POST /api/teams
 *
 * Returns teams playable with the given character roster for both
 * Abyss and Stygian Onslaught.
 *
 * Body: { characters: string[]; abyssVersion: number; stygianVersion: number }
 *
 * Cache: memory L1 + optional Valkey L2 (VALKEY_URL), keyed by roster + version.
 * Rate limit: 60 requests / minute / IP (Valkey-shared when configured).
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import {
  rpcCache,
  checkApiRateLimit,
  getClientIp,
  buildRpcKey,
  assertCharacterNameIds,
} from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  E2E_ABYSS_TEAM_BOTTOM,
  E2E_ABYSS_TEAM_TOP,
  E2E_STYGIAN_TEAM_BOTTOM,
  E2E_STYGIAN_TEAM_MIDDLE,
  E2E_STYGIAN_TEAM_TOP,
} from "$lib/e2e/fixtures";
import {
  isSupportedAbyssVersion,
  isSupportedStygianVersion,
} from "$lib/server/version-validation";

type TeamsBody = {
  characters: string[];
  abyssVersion: number;
  stygianVersion: number;
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  if (isPlaywrightE2e()) {
    return json({
      abyssTeams: [E2E_ABYSS_TEAM_TOP, E2E_ABYSS_TEAM_BOTTOM],
      stygianTeams: [
        E2E_STYGIAN_TEAM_TOP,
        E2E_STYGIAN_TEAM_MIDDLE,
        E2E_STYGIAN_TEAM_BOTTOM,
      ],
    });
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = getClientIp(request, getClientAddress);
  if (!(await checkApiRateLimit(ip))) {
    throw error(429, "Too many requests — please wait a moment.");
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw error(400, "Invalid JSON body.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw error(400, "Invalid JSON body.");
  }
  const body = parsed as TeamsBody;

  const { characters: rawCharacters, abyssVersion, stygianVersion } = body;

  let characters: string[];
  try {
    characters = assertCharacterNameIds(rawCharacters);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : "Invalid characters.");
  }

  if (
    typeof abyssVersion !== "number" ||
    !Number.isFinite(abyssVersion) ||
    !Number.isInteger(abyssVersion) ||
    typeof stygianVersion !== "number" ||
    !Number.isFinite(stygianVersion) ||
    !Number.isInteger(stygianVersion)
  ) {
    throw error(400, "abyssVersion and stygianVersion must be numbers.");
  }

  let supportedVersions: [boolean, boolean];
  try {
    supportedVersions = await Promise.all([
      isSupportedAbyssVersion(abyssVersion),
      isSupportedStygianVersion(stygianVersion),
    ]);
  } catch (e) {
    console.error("[teams] version validation failed:", e);
    throw error(500, "Internal server error");
  }
  if (!supportedVersions[0] || !supportedVersions[1]) {
    throw error(400, "abyssVersion and stygianVersion must be numbers.");
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const abyssKey = buildRpcKey("owned_abyss", abyssVersion, characters);
  const stygianKey = buildRpcKey("owned_stygian", stygianVersion, characters);

  const [abyssTeams, stygianTeams] = await Promise.all([
    rpcCache.getOrSet(abyssKey, async () => {
      const { data, error: err } = await serverDb.rpc(
        "get_teams_with_characters_subset",
        {
          p_name_ids: characters,
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
          p_name_ids: characters,
          p_version_number: stygianVersion,
        },
      );
      if (err) throw new Error(err.message);
      return data ?? [];
    }),
  ]);

  return json({ abyssTeams, stygianTeams });
};
