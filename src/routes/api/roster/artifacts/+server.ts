/**
 * GET /api/roster/artifacts
 *
 * Auth-scoped GOOD artifacts slice. Empty when unset or before the owner
 * migration. Character Builds calls loadRosterArtifacts() — not bootstrap.
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
  if (isPlaywrightE2e()) return Response.json({ artifacts: [] });

  const { data, error: err } = await selectUserRosterColumn(
    user.id,
    "artifacts",
  );
  assertNoDbError("GET /api/roster/artifacts", err);

  return Response.json({ artifacts: Array.isArray(data) ? data : [] });
};
