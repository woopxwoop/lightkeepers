/**
 * GET/POST/DELETE /api/calculator-goals
 *
 * Auth-gated upgrade-goal sync. Mirrors `/api/roster`.
 * GET → { goals, rev, account }. POST { goals, baseRev?, account? } → 200 { ok, rev } or
 * 409 { goals, rev } when `baseRev` is stale (`#lib/server/account-doc.js`).
 */

import type { RequestHandler } from "./$types";
import { serverDb } from "#lib/server/supabaseServer.js";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";
import {
  accountDocWriteResponse,
  goalsDoc,
} from "#lib/server/account-doc-tables.js";
import {
  assertNoDbError,
  requireJsonObject,
  requireUser,
} from "#lib/server/validation/core.js";
import { requireCalculatorGoals } from "#lib/server/validation/goals.js";
import {
  requireBaseRev,
  requireExpectedAccount,
  requireMatchingAccount,
} from "#lib/server/validation/roster.js";

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { data, rev, error: err } = await goalsDoc.read(user.id, "goals");
  assertNoDbError("GET /api/calculator-goals", err);

  return Response.json({ goals: data, rev, account: user.id });
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
  const baseRev = requireBaseRev(body.baseRev);
  requireExpectedAccount(body.account, user.id);

  return accountDocWriteResponse({
    label: "POST /api/calculator-goals",
    doc: goalsDoc,
    userId: user.id,
    column: "goals",
    result: await goalsDoc.write(user.id, { goals }, baseRev),
  });
};

export const DELETE: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);
  const body = await requireJsonObject(request);
  requireMatchingAccount(body.account, user.id);

  const { error: err } = await serverDb
    .from("user_calculator_goals")
    .delete()
    .eq("user_id", user.id);
  assertNoDbError("DELETE /api/calculator-goals", err);

  return Response.json({ ok: true });
};
