/**
 * GET /api/roster/weapons
 *
 * Auth-scoped GOOD weapons slice. Empty when unset or before the owner
 * migration. Not loaded by bootstrap — planner / pulls call loadRosterWeapons().
 */

import type { RequestHandler } from "./$types";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";
import {
  assertNoDbError,
  requireUser,
} from "#lib/server/request-validation.js";
import { selectUserRosterColumn } from "#lib/server/user-rosters.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  const user = requireUser(locals);
  if (isPlaywrightE2e()) return Response.json({ weapons: [] });

  const { data, error: err } = await selectUserRosterColumn(user.id, "weapons");
  assertNoDbError("GET /api/roster/weapons", err);

  return Response.json({ weapons: Array.isArray(data) ? data : [] });
};
