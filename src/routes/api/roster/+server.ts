/**
 * GET/POST/DELETE /api/roster
 *
 * Auth-gated roster sync for logged-in users. Every handler is rate limited,
 * requires a session, and scopes reads/writes to that user's row.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import {
  assertNoDbError,
  requireJsonObject,
  requireRosterEntries,
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

  const { error: err } = await serverDb.from("user_rosters").upsert(
    {
      user_id: user.id,
      roster,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  assertNoDbError("POST /api/roster", err);

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
    .from("user_rosters")
    .delete()
    .eq("user_id", user.id);
  assertNoDbError("DELETE /api/roster", err);

  return json({ ok: true });
};
