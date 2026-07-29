/**
 * POST /api/nearmiss
 *
 * Pull-suggestion near-misses for Stygian:
 *   - nearMissTeams  — one character short
 *   - nearMissPairs  — two short, PMI-filtered
 *
 * Body: { characters: string[]; stygianVersion: number; minPmi?: number }
 *
 * Cache: rpcCache (L1 + optional Valkey), keyed by roster + version.
 * Rate limit: 60 req/min/IP via checkApiRateLimit (Valkey when configured).
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { rpcCache, buildRpcKey } from "$lib/server/cache";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  requireCharacterNameIds,
  requireFiniteInteger,
  requireJsonObject,
  requireNumberInRange,
} from "$lib/server/request-validation";
import { isSupportedStygianVersion } from "$lib/server/version-validation";

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  // Default empty; Playwright browser routes override with scenario fixtures.
  if (isPlaywrightE2e()) {
    return json({ nearMissTeams: [], nearMissPairs: [] });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  // ── Parse body ───────────────────────────────────────────────────────────
  const body = await requireJsonObject(request);
  const characters = requireCharacterNameIds(body.characters);
  const stygianVersion = requireFiniteInteger(
    body.stygianVersion,
    "stygianVersion must be a number.",
  );
  const minPmi = requireNumberInRange(
    body.minPmi ?? 0.3,
    0,
    1,
    "minPmi must be a number between 0 and 1.",
  );

  let supportedVersion: boolean;
  try {
    supportedVersion = await isSupportedStygianVersion(stygianVersion);
  } catch (e) {
    console.error("[nearmiss] stygian version validation failed:", e);
    throw error(500, "Internal server error");
  }
  if (!supportedVersion) {
    throw error(400, "stygianVersion must be a number.");
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────
  // Key on the caller's exact threshold — rounding could widen the filter.
  const singleKey = buildRpcKey("near_miss_single", stygianVersion, characters);
  const pairKey = buildRpcKey(
    `near_miss_pair_pmi${minPmi}`,
    stygianVersion,
    characters,
  );

  let nearMissTeams: unknown, nearMissPairs: unknown;
  try {
    [nearMissTeams, nearMissPairs] = await Promise.all([
      rpcCache.getOrSet(singleKey, async () => {
        const { data, error: err } = await serverDb.rpc(
          "get_near_miss_stygian_teams",
          {
            p_name_ids: characters,
            p_version_number: stygianVersion,
          },
        );
        if (err) {
          console.error("[nearmiss] get_near_miss_stygian_teams error:", err);
          throw new Error(err.message);
        }
        return data ?? [];
      }),

      rpcCache.getOrSet(pairKey, async () => {
        const { data, error: err } = await serverDb.rpc(
          "get_near_miss_stygian_pairs",
          {
            p_name_ids: characters,
            p_version_number: stygianVersion,
            p_min_pmi: minPmi,
          },
        );
        if (err) {
          console.error("[nearmiss] get_near_miss_stygian_pairs error:", err);
          throw new Error(err.message);
        }
        return data ?? [];
      }),
    ]);
  } catch (e) {
    console.error("[nearmiss] RPC failed:", e);
    throw error(500, "Internal server error");
  }

  return json({ nearMissTeams, nearMissPairs });
};
