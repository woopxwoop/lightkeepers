/**
 * `user_rosters` extra JSONB slices (`weapons`, `artifacts`).
 * Generated Database types do not include these columns until the owner
 * migrates + `pnpm update-types`. Payloads are asserted at the call site.
 */

import { serverDb } from "$lib/server/supabaseServer";
import type { InventoryArtifact, InventoryWeapon } from "$lib/definitions";
import type { RosterEntry } from "$lib/server/request-validation";

export type RosterInventoryRow = {
  user_id: string;
  roster: RosterEntry[];
  updated_at: string;
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
    /column .* does not exist/i.test(message) ||
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
  upsert: (
    row: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: unknown }>;
};

function rosterTable(): RosterQuery {
  return serverDb.from("user_rosters") as unknown as RosterQuery;
}

/** Upsert roster; include inventory slices only when provided. Retry without them if the columns are missing. */
export async function upsertUserRoster(
  row: RosterInventoryRow,
): Promise<{ error: unknown }> {
  const payload: Record<string, unknown> = {
    user_id: row.user_id,
    roster: row.roster,
    updated_at: row.updated_at,
  };
  if (row.weapons !== undefined) payload.weapons = row.weapons;
  if (row.artifacts !== undefined) payload.artifacts = row.artifacts;

  const table = rosterTable();
  const first = await table.upsert(payload, { onConflict: "user_id" });
  if (
    first.error &&
    (row.weapons !== undefined || row.artifacts !== undefined) &&
    isMissingInventoryColumn(first.error)
  ) {
    return table.upsert(
      {
        user_id: row.user_id,
        roster: row.roster,
        updated_at: row.updated_at,
      },
      { onConflict: "user_id" },
    );
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
    return { data: null, error: null };
  }
  return { data: data?.[column] ?? null, error };
}
