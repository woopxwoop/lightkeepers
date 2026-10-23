/**
 * GET /api/stygian-enemy-teams?enemyId=…
 *
 * Historical top teams per Stygian cycle for one boss, ranked by the
 * slot-specific field_*_rate. Public meta — cache like character-analytics.
 */

import type { RequestHandler } from "./$types";
import { serverDb } from "#lib/server/supabaseServer.js";
import { LRUCache } from "#lib/server/cache.js";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import {
  assertNoDbError,
  requireEnemyId,
} from "#lib/server/request-validation.js";
import { TOP_TEAMS_LIMIT } from "#lib/character-teams.js";
import type { StygianEnemyTeamsPayload } from "#lib/definitions.js";
import { e2eStygianEnemyTeamsPayload } from "#lib/e2e/fixtures.js";

const enemyTeamsCache = new LRUCache<StygianEnemyTeamsPayload>(
  256,
  15 * 60 * 1000,
  {
    redisNamespace: "stygian-enemy-teams",
    staleWhileRevalidate: true,
  },
);

async function fetchEnemyTeams(
  enemyId: number,
): Promise<StygianEnemyTeamsPayload> {
  const teamsRes = await serverDb.rpc("get_top_teams_for_stygian_enemy", {
    p_enemy_id: enemyId,
    p_limit: TOP_TEAMS_LIMIT,
  });
  assertNoDbError("stygian-enemy-teams", teamsRes.error);
  return {
    enemyId,
    teams: teamsRes.data ?? [],
  };
}

export const GET: RequestHandler = async ({
  request,
  url,
  getClientAddress,
}) => {
  const enemyId = requireEnemyId(url.searchParams.get("enemyId"));

  if (isPlaywrightE2e()) {
    return Response.json(e2eStygianEnemyTeamsPayload(enemyId), {
      headers: {
        "Cache-Control": "no-store",
        "X-Playwright-E2E": "1",
      },
    });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  const payload = await enemyTeamsCache.getOrSet(String(enemyId), () =>
    fetchEnemyTeams(enemyId),
  );

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
