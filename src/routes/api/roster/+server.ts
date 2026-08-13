/**
 * GET/POST/DELETE /api/roster
 *
 * Auth-gated roster sync for logged-in users. Every handler is rate limited,
 * requires a session, and scopes reads/writes to that user's row.
 * GET selects `roster` only. Optional POST `weapons` / `artifacts` write the
 * inventory slices without clearing them on roster-only saves.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import {
  assertNoDbError,
  requireInventoryArtifacts,
  requireInventoryWeapons,
  requireJsonObject,
  requireRosterEntries,
  requireUser,
} from "$lib/server/request-validation";
import { upsertUserRoster } from "$lib/server/user-rosters";

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { data, error: err } = await serverDb
    .from("user_rosters")
    .select("roster")
    .eq("user_id", user.id)
    .maybeSingle();
  assertNoDbError("GET /api/roster", err);

  return json({ roster: data?.roster ?? null });
};

export const POST: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const body = await requireJsonObject(request);
  const roster = requireRosterEntries(body.roster);
  const weapons =
    body.weapons === undefined
      ? undefined
      : requireInventoryWeapons(body.weapons);
  const artifacts =
    body.artifacts === undefined
      ? undefined
      : requireInventoryArtifacts(body.artifacts);

  const { error: err, inventoryOmitted } = await upsertUserRoster({
    user_id: user.id,
    roster,
    updated_at: new Date().toISOString(),
    ...(weapons !== undefined ? { weapons } : {}),
    ...(artifacts !== undefined ? { artifacts } : {}),
  });
  assertNoDbError("POST /api/roster", err);

  return json({
    ok: true,
    ...(inventoryOmitted ? { inventoryOmitted: true } : {}),
  });
};

export const DELETE: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { error: err } = await serverDb
    .from("user_rosters")
    .delete()
    .eq("user_id", user.id);
  assertNoDbError("DELETE /api/roster", err);

  return json({ ok: true });
};
