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

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { cachedRosterRpc } from "$lib/server/cached-rpc";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { isPlaywrightE2e } from "$lib/server/e2e";
import {
  requireCharacterNameIds,
  requireFiniteInteger,
  requireJsonObject,
  requireNumberInRange,
} from "$lib/server/request-validation";
import { requireSupportedStygianVersion } from "$lib/server/version-validation";

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

  await requireSupportedStygianVersion(stygianVersion);

  // ── Cache lookup ─────────────────────────────────────────────────────────
  // Key on the caller's exact threshold — rounding could widen the filter.
  const [nearMissTeams, nearMissPairs] = await Promise.all([
    cachedRosterRpc({
      cacheName: "near_miss_single",
      versionNumber: stygianVersion,
      characters,
      run: () =>
        serverDb.rpc("get_near_miss_stygian_teams", {
          p_name_ids: characters,
          p_version_number: stygianVersion,
        }),
    }),

    cachedRosterRpc({
      cacheName: `near_miss_pair_pmi${minPmi}`,
      versionNumber: stygianVersion,
      characters,
      run: () =>
        serverDb.rpc("get_near_miss_stygian_pairs", {
          p_name_ids: characters,
          p_version_number: stygianVersion,
          p_min_pmi: minPmi,
        }),
    }),
  ]);

  return json({ nearMissTeams, nearMissPairs });
};
