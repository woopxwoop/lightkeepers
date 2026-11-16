/**
 * The app's account-document tables, bound to the service-role client.
 * The only place `serverDb` is narrowed to `AccountDocDb`.
 */

import { serverDb } from "#lib/server/supabaseServer.js";
import {
  accountDocTable,
  type AccountDocDb,
  type AccountDocWrite,
} from "#lib/server/account-doc.js";
import { assertNoDbError } from "#lib/server/validation/core.js";

const db = serverDb as unknown as AccountDocDb;

export const rosterDoc = accountDocTable(db, "user_rosters");
export const goalsDoc = accountDocTable(db, "user_calculator_goals");

type AccountDoc = ReturnType<typeof accountDocTable>;

/**
 * Turn a write result into the route response: `200 { ok, rev, ...extra }`,
 * or `409 { [column], rev }` carrying the server's current copy so the
 * client can merge. Database errors become the generic 500.
 */
export async function accountDocWriteResponse(input: {
  label: string;
  doc: AccountDoc;
  userId: string;
  column: string;
  result: AccountDocWrite;
  extra?: Record<string, unknown>;
}): Promise<Response> {
  const { label, doc, userId, column, result } = input;
  if (result.status === "error") {
    assertNoDbError(label, result.error ?? new Error("write failed"));
  }
  if (result.status === "written") {
    return Response.json({ ok: true, rev: result.rev, ...input.extra });
  }
  const current = await doc.read(userId, column);
  assertNoDbError(label, current.error);
  return Response.json(
    { [column]: current.data, rev: current.rev },
    { status: 409 },
  );
}
