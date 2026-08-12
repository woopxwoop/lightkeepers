/**
 * GET/POST/DELETE /api/calculator-goals
 *
 * Auth-gated upgrade-goal sync. Mirrors `/api/roster`.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import {
  assertNoDbError,
  requireCalculatorGoals,
  requireJsonObject,
  requireUser,
} from "$lib/server/request-validation";

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { data, error: err } = await serverDb
    .from("user_calculator_goals")
    .select("goals")
    .eq("user_id", user.id)
    .maybeSingle();
  assertNoDbError("GET /api/calculator-goals", err);

  return json({ goals: data?.goals ?? null });
};

export const POST: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const body = await requireJsonObject(request);
  const goals = requireCalculatorGoals(body.goals);

  const { error: err } = await serverDb.from("user_calculator_goals").upsert(
    {
      user_id: user.id,
      goals,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  assertNoDbError("POST /api/calculator-goals", err);

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { error: err } = await serverDb
    .from("user_calculator_goals")
    .delete()
    .eq("user_id", user.id);
  assertNoDbError("DELETE /api/calculator-goals", err);

  return json({ ok: true });
};
