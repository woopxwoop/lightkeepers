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
import {
  rpcCache,
  checkApiRateLimit,
  getClientIp,
  buildRpcKey,
  assertCharacterNameIds,
} from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";

type NearMissBody = {
  characters: string[];
  stygianVersion: number;
  minPmi?: number;
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  // Default empty; Playwright browser routes override with scenario fixtures.
  if (isPlaywrightE2e()) {
    return json({ nearMissTeams: [], nearMissPairs: [] });
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = getClientIp(request, getClientAddress);
  if (!(await checkApiRateLimit(ip))) {
    throw error(429, "Too many requests — please wait a moment.");
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: NearMissBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body.");
  }

  const { characters: rawCharacters, stygianVersion, minPmi = 0.3 } = body;

  let characters: string[];
  try {
    characters = assertCharacterNameIds(rawCharacters);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : "Invalid characters.");
  }

  if (typeof stygianVersion !== "number" || !Number.isFinite(stygianVersion)) {
    throw error(400, "stygianVersion must be a number.");
  }
  if (
    typeof minPmi !== "number" ||
    !Number.isFinite(minPmi) ||
    minPmi < 0 ||
    minPmi > 1
  ) {
    throw error(400, "minPmi must be a number between 0 and 1.");
  }

  // Quantize for stable cache keys / RPC args (avoid float key churn).
  const minPmiKey = Math.round(minPmi * 100) / 100;

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const singleKey = buildRpcKey("near_miss_single", stygianVersion, characters);
  const pairKey = buildRpcKey(
    `near_miss_pair_pmi${minPmiKey}`,
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
            p_min_pmi: minPmiKey,
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
