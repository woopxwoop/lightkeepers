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

import type { RequestHandler } from "./$types";
import { serverDb } from "#lib/server/supabaseServer.js";
import { cachedRosterRpc } from "#lib/server/cached-rpc.js";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import {
  E2E_ABYSS_TEAM_BOTTOM,
  E2E_ABYSS_TEAM_TOP,
  E2E_STYGIAN_TEAM_BOTTOM,
  E2E_STYGIAN_TEAM_MIDDLE,
  E2E_STYGIAN_TEAM_TOP,
} from "#lib/e2e/fixtures.js";
import {
  requireCharacterNameIds,
  requireFiniteInteger,
  requireJsonObject,
} from "#lib/server/request-validation.js";
import { requireSupportedAbyssAndStygianVersions } from "#lib/server/version-validation.js";

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  if (isPlaywrightE2e()) {
    return Response.json({
      abyssTeams: [E2E_ABYSS_TEAM_TOP, E2E_ABYSS_TEAM_BOTTOM],
      stygianTeams: [
        E2E_STYGIAN_TEAM_TOP,
        E2E_STYGIAN_TEAM_MIDDLE,
        E2E_STYGIAN_TEAM_BOTTOM,
      ],
    });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  // ── Parse body ───────────────────────────────────────────────────────────
  const body = await requireJsonObject(request);
  const characters = requireCharacterNameIds(body.characters);
  const versionError = "abyssVersion and stygianVersion must be numbers.";
  const abyssVersion = requireFiniteInteger(body.abyssVersion, versionError);
  const stygianVersion = requireFiniteInteger(
    body.stygianVersion,
    versionError,
  );

  await requireSupportedAbyssAndStygianVersions(abyssVersion, stygianVersion);

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const [abyssTeams, stygianTeams] = await Promise.all([
    cachedRosterRpc({
      cacheName: "owned_abyss",
      versionNumber: abyssVersion,
      characters,
      run: () =>
        serverDb.rpc("get_teams_with_characters_subset", {
          p_name_ids: characters,
          p_version_number: abyssVersion,
        }),
    }),

    cachedRosterRpc({
      cacheName: "owned_stygian",
      versionNumber: stygianVersion,
      characters,
      run: () =>
        serverDb.rpc("get_teams_with_characters_subset_stygian", {
          p_name_ids: characters,
          p_version_number: stygianVersion,
        }),
    }),
  ]);

  return Response.json({ abyssTeams, stygianTeams });
};
