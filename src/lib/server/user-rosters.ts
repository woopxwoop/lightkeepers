/**
 * `user_rosters` extra JSONB slices (`weapons`, `artifacts`).
 * Fallback for missing columns is temporary and may be removed once all target
 * deployments include the migration and generated types are synchronized
 * (`pnpm update-types`). Until then, payloads stay asserted at the call site.
 */

import { serverDb } from "#lib/server/supabaseServer.js";
import type { InventoryArtifact, InventoryWeapon } from "#lib/definitions.js";
import type { RosterEntry } from "#lib/server/request-validation.js";
import type { AccountDocWrite, BaseRev } from "#lib/server/account-doc.js";
import { rosterDoc } from "#lib/server/account-doc-tables.js";

export type RosterWriteRow = {
  user_id: string;
  roster: RosterEntry[];
  weapons?: InventoryWeapon[] | null;
  artifacts?: InventoryArtifact[] | null;
};

function isMissingInventoryColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as { code?: unknown; message?: unknown };
  const code = typeof rec.code === "string" ? rec.code : "";
  const message = typeof rec.message === "string" ? rec.message : "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /column ['"]?(weapons|artifacts)['"]? does not exist/i.test(message) ||
    /Could not find the ['"]?(weapons|artifacts)['"]? column/i.test(message)
  );
}

type RosterQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => Promise<{
        data: Record<string, unknown> | null;
        error: unknown;
      }>;
    };
  };
};

function rosterTable(): RosterQuery {
  return serverDb.from("user_rosters") as unknown as RosterQuery;
}

export type WriteUserRosterResult = AccountDocWrite & {
  inventoryOmitted?: boolean;
};

/**
 * Write the roster under the `baseRev` rule (`#lib/server/account-doc.js`).
 * Inventory slices are included only when provided. If those columns are
 * missing, the same conditional write is retried with the roster only.
 */
export async function writeUserRoster(
  row: RosterWriteRow,
  baseRev: BaseRev,
): Promise<WriteUserRosterResult> {
  const columns: Record<string, unknown> = { roster: row.roster };
  if (row.weapons !== undefined) columns.weapons = row.weapons;
  if (row.artifacts !== undefined) columns.artifacts = row.artifacts;

  const first = await rosterDoc.write(row.user_id, columns, baseRev);
  if (
    first.status === "error" &&
    (row.weapons !== undefined || row.artifacts !== undefined) &&
    isMissingInventoryColumn(first.error)
  ) {
    console.warn(
      "POST /api/roster: weapons/artifacts columns missing; saving roster only",
    );
    const retry = await rosterDoc.write(
      row.user_id,
      { roster: row.roster },
      baseRev,
    );
    return { ...retry, inventoryOmitted: true };
  }
  return first;
}

export async function selectUserRosterColumn(
  userId: string,
  column: "weapons" | "artifacts",
): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await rosterTable()
    .select(column)
    .eq("user_id", userId)
    .maybeSingle();
  if (error && isMissingInventoryColumn(error)) {
    console.warn(
      `GET /api/roster/${column}: column missing; returning empty slice`,
      error,
    );
    return { data: null, error: null };
  }
  return { data: data?.[column] ?? null, error };
}
