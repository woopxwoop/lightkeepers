/**
 * POST /api/stygian-clear-videos
 *
 * Body: { pairs: { team_key, enemy_id }[] }
 * Returns clear-video rows for those team×boss pairs (public meta).
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  assertNoDbError,
  requireJsonObject,
  requireTeamEnemyPairs,
} from "$lib/server/request-validation";
import type { StygianClearVideosPayload } from "$lib/definitions";

function pairKey(teamKey: string, enemyId: number): string {
  return `${teamKey}|${enemyId}`;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const body = await requireJsonObject(request);
  const pairs = requireTeamEnemyPairs(body.pairs);

  if (isPlaywrightE2e()) {
    const payload: StygianClearVideosPayload = { clears: [] };
    return json(payload, {
      headers: { "Cache-Control": "no-store", "X-Playwright-E2E": "1" },
    });
  }

  const wanted = new Set(pairs.map((p) => pairKey(p.team_key, p.enemy_id)));
  const teamKeys = [...new Set(pairs.map((p) => p.team_key))];
  const enemyIds = [...new Set(pairs.map((p) => p.enemy_id))];

  const { data, error } = await serverDb
    .from("stygian_team_clear_videos")
    .select(
      "clear_key, team_key, enemy_id, difficulty, cost, time_s, video_url, char_names",
    )
    .in("team_key", teamKeys)
    .in("enemy_id", enemyIds);

  assertNoDbError("stygian-clear-videos", error);

  const clears = (data ?? [])
    .filter((row) => wanted.has(pairKey(row.team_key, row.enemy_id)))
    .sort((a, b) => {
      const costA = a.cost ?? Number.POSITIVE_INFINITY;
      const costB = b.cost ?? Number.POSITIVE_INFINITY;
      if (costA !== costB) return costA - costB;
      const timeA = a.time_s ?? Number.POSITIVE_INFINITY;
      const timeB = b.time_s ?? Number.POSITIVE_INFINITY;
      return timeA - timeB;
    });

  const payload: StygianClearVideosPayload = { clears };
  return json(payload, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
};
