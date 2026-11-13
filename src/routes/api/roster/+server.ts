/**
 * GET/POST/DELETE /api/roster
 *
 * Auth-gated roster sync for logged-in users. Every handler is rate limited,
 * requires a session, and scopes reads/writes to that user's row.
 * GET → { roster, rev, account }. Optional POST `weapons` / `artifacts` write the
 * inventory slices without clearing them on roster-only saves.
 * POST { roster, baseRev?, account? } → 200 { ok, rev } or 409 { roster, rev } when
 * `baseRev` is stale (`#lib/server/account-doc.js`).
 */

import type { RequestHandler } from "./$types";
import { serverDb } from "#lib/server/supabaseServer.js";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";
import {
  accountDocWriteResponse,
  rosterDoc,
} from "#lib/server/account-doc-tables.js";
import {
  assertNoDbError,
  requireBaseRev,
  requireExpectedAccount,
  requireInventoryArtifacts,
  requireInventoryWeapons,
  requireJsonObject,
  requireMatchingAccount,
  requireRosterEntries,
  requireUser,
} from "#lib/server/request-validation.js";
import { writeUserRoster } from "#lib/server/user-rosters.js";

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);

  const { data, rev, error: err } = await rosterDoc.read(user.id, "roster");
  assertNoDbError("GET /api/roster", err);

  return Response.json({ roster: data, rev, account: user.id });
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

  const baseRev = requireBaseRev(body.baseRev);
  requireExpectedAccount(body.account, user.id);

  const result = await writeUserRoster(
    {
      user_id: user.id,
      roster,
      ...(weapons !== undefined ? { weapons } : {}),
      ...(artifacts !== undefined ? { artifacts } : {}),
    },
    baseRev,
  );
  return accountDocWriteResponse({
    label: "POST /api/roster",
    doc: rosterDoc,
    userId: user.id,
    column: "roster",
    result,
    extra: result.inventoryOmitted ? { inventoryOmitted: true } : undefined,
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
    .from("user_rosters")
    .delete()
    .eq("user_id", user.id);
  assertNoDbError("DELETE /api/roster", err);

  return Response.json({ ok: true });
};
