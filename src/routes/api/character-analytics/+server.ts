/**
 * GET /api/character-analytics?nameId=…&mode=abyss|stygian
 *
 * Per-character usage series + top teams by version. Public meta (not
 * roster-keyed) — cache like /api/tierlist.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { LRUCache } from "$lib/server/cache";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  assertNoDbError,
  requireAnalyticsMode,
  requireCharacterNameId,
} from "$lib/server/request-validation";
import { TOP_TEAMS_LIMIT } from "$lib/character-teams";
import type { CharacterAnalyticsPayload } from "$lib/definitions";
import { e2eCharacterAnalyticsPayload } from "$lib/e2e/fixtures";

const analyticsCache = new LRUCache<CharacterAnalyticsPayload>(
  256,
  15 * 60 * 1000,
  {
    redisNamespace: "character-analytics",
    staleWhileRevalidate: true,
  },
);

async function fetchCharacterAnalytics(
  nameId: string,
  mode: "abyss" | "stygian",
): Promise<CharacterAnalyticsPayload> {
  if (mode === "stygian") {
    const [usageRes, teamsRes] = await Promise.all([
      serverDb.rpc("get_character_usage_series_stygian", {
        p_name_id: nameId,
      }),
      serverDb.rpc("get_character_top_teams_by_version_stygian", {
        p_name_id: nameId,
        p_limit: TOP_TEAMS_LIMIT,
      }),
    ]);
    assertNoDbError("character-analytics usage stygian", usageRes.error);
    assertNoDbError("character-analytics teams stygian", teamsRes.error);
    return {
      nameId,
      mode: "stygian" as const,
      usage: usageRes.data ?? [],
      teams: teamsRes.data ?? [],
    };
  }

  const [usageRes, teamsRes] = await Promise.all([
    serverDb.rpc("get_character_usage_series_abyss", { p_name_id: nameId }),
    serverDb.rpc("get_character_top_teams_by_version_abyss", {
      p_name_id: nameId,
      p_limit: TOP_TEAMS_LIMIT,
    }),
  ]);
  assertNoDbError("character-analytics usage abyss", usageRes.error);
  assertNoDbError("character-analytics teams abyss", teamsRes.error);
  return {
    nameId,
    mode: "abyss" as const,
    usage: usageRes.data ?? [],
    teams: teamsRes.data ?? [],
  };
}

export const GET: RequestHandler = async ({
  request,
  url,
  getClientAddress,
}) => {
  if (isPlaywrightE2e()) {
    const nameId = requireCharacterNameId(url.searchParams.get("nameId"));
    const mode = requireAnalyticsMode(url.searchParams.get("mode"));
    return json(e2eCharacterAnalyticsPayload(nameId, mode), {
      headers: {
        "Cache-Control": "no-store",
        "X-Playwright-E2E": "1",
      },
    });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  const nameId = requireCharacterNameId(url.searchParams.get("nameId"));
  const mode = requireAnalyticsMode(url.searchParams.get("mode"));
  const cacheKey = `${mode}:${nameId}`;

  const payload = await analyticsCache.getOrSet(cacheKey, () =>
    fetchCharacterAnalytics(nameId, mode),
  );

  return json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};
