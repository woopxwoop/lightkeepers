/**
 * POST /api/stygian-cheap-clears
 *
 * Owned Stygian teams × Fearless (or Dire) clears with a cost/time Pareto
 * frontier under p_max_cost (+0.5 slack). Clients pick the best point for
 * the active ceiling (user cap or C0R0 floor).
 *
 * Body: {
 *   characters: string[];
 *   stygianVersion: number;
 *   enemyIds: number[];
 *   difficulty?: "Fearless" | "Dire";
 *   maxCost?: number; // inclusive scrape-cost filter for aggregation (default 0)
 * }
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { cachedRosterRpc } from "$lib/server/cached-rpc";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  requireCharacterNameIds,
  requireEnemyIds,
  requireFiniteInteger,
  requireJsonObject,
  requireNumberInRange,
  requireStygianClearDifficulty,
} from "$lib/server/request-validation";
import { requireSupportedStygianVersion } from "$lib/server/version-validation";
import type {
  StygianCheapClearRow,
  StygianCheapClearsPayload,
} from "$lib/definitions";
import { STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST } from "$lib/definitions";

const MAX_COST_CAP = 10_000;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  if (isPlaywrightE2e()) {
    const payload: StygianCheapClearsPayload = { rows: [] };
    return json(payload, {
      headers: { "Cache-Control": "no-store", "X-Playwright-E2E": "1" },
    });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  const body = await requireJsonObject(request);
  const characters = requireCharacterNameIds(body.characters);
  const stygianVersion = requireFiniteInteger(
    body.stygianVersion,
    "stygianVersion must be a number.",
  );
  const enemyIds = requireEnemyIds(body.enemyIds);
  const difficulty = requireStygianClearDifficulty(body.difficulty);
  const maxCost =
    body.maxCost === undefined || body.maxCost === null
      ? STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST
      : requireNumberInRange(
          body.maxCost,
          0,
          MAX_COST_CAP,
          `maxCost must be between 0 and ${MAX_COST_CAP}.`,
        );

  await requireSupportedStygianVersion(stygianVersion);

  const enemyKey = [...enemyIds].sort((a, b) => a - b).join(",");
  const rows = await cachedRosterRpc<StygianCheapClearRow>({
    cacheName: `stygian_cheap_clears:${difficulty}:c${maxCost}:${enemyKey}`,
    versionNumber: stygianVersion,
    characters,
    run: () =>
      serverDb.rpc("get_stygian_cheap_clears_for_roster", {
        p_name_ids: characters,
        p_version_number: stygianVersion,
        p_enemy_ids: enemyIds,
        p_difficulty: difficulty,
        p_max_cost: maxCost,
      }),
  });

  const payload: StygianCheapClearsPayload = { rows };
  return json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
};
