/**
 * GET /api/roster/artifacts
 *
 * Auth-scoped GOOD artifacts slice. Empty when unset or before the owner
 * migration. Character Builds calls loadRosterArtifacts() — not bootstrap.
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
  const user = requireUser(locals);
  if (isPlaywrightE2e()) return json({ artifacts: [] });

  const { data, error: err } = await selectUserRosterColumn(
    user.id,
    "artifacts",
  );
  assertNoDbError("GET /api/roster/artifacts", err);

  return json({ artifacts: Array.isArray(data) ? data : [] });
};
