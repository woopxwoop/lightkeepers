/**
 * GET /api/stygian-enemy-teams?enemyId=…
 *
 * Historical top teams per Stygian cycle for one boss, ranked by the
 * slot-specific field_*_rate. Public meta — cache like character-analytics.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { LRUCache } from "$lib/server/cache";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  assertNoDbError,
  requireEnemyId,
} from "$lib/server/request-validation";
import { TOP_TEAMS_LIMIT } from "$lib/character-teams";
import type { StygianEnemyTeamsPayload } from "$lib/definitions";
import { e2eStygianEnemyTeamsPayload } from "$lib/e2e/fixtures";

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
    return json(e2eStygianEnemyTeamsPayload(enemyId), {
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

  return json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
