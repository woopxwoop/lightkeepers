/**
 * GET/POST/DELETE /api/calculator-goals
 *
 * Auth-gated upgrade-goal sync. Mirrors `/api/roster`.
 *
 * Requires table `user_calculator_goals` (owner migration + `pnpm update-types`).
 * Until generated types include the table, queries go through a narrow cast.
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
import type { CalculatorGoal } from "$lib/types/calculator-goals";

/** Interim client until `user_calculator_goals` lands in database.types.ts. */
type GoalsRow = {
  user_id: string;
  goals: CalculatorGoal[];
  updated_at: string;
};

type GoalsTable = {
  select: (cols: string) => {
    eq: (
      col: string,
      value: string,
    ) => {
      maybeSingle: () => Promise<{ data: GoalsRow | null; error: unknown }>;
    };
  };
  upsert: (
    row: GoalsRow,
    opts: { onConflict: string },
  ) => Promise<{ error: unknown }>;
  delete: () => {
    eq: (col: string, value: string) => Promise<{ error: unknown }>;
  };
};

function goalsTable(): GoalsTable {
  return (serverDb as unknown as { from: (name: string) => GoalsTable }).from(
    "user_calculator_goals",
  );
}

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { data, error: err } = await goalsTable()
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

  const { error: err } = await goalsTable().upsert(
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

  const { error: err } = await goalsTable().delete().eq("user_id", user.id);
  assertNoDbError("DELETE /api/calculator-goals", err);

  return json({ ok: true });
};
