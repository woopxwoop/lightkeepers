/**
 * GET /api/roster/weapons
 *
 * Auth-scoped GOOD weapons slice. Empty when unset or before the owner
 * migration. Not loaded by bootstrap — planner / pulls call loadRosterWeapons().
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import { assertNoDbError, requireUser } from "$lib/server/request-validation";
import { selectUserRosterColumn } from "$lib/server/user-rosters";
import { isPlaywrightE2e } from "$lib/server/e2e";

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  if (isPlaywrightE2e()) return json({ weapons: [] });
  const user = requireUser(locals);

  const { data, error: err } = await selectUserRosterColumn(user.id, "weapons");
  assertNoDbError("GET /api/roster/weapons", err);

  return json({ weapons: Array.isArray(data) ? data : [] });
};
