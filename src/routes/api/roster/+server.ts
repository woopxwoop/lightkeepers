import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import {
  MAX_NAME_ID_LENGTH,
  MAX_ROSTER_CHARACTERS,
} from "$lib/server/cache";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const { data, error: err } = await serverDb
    .from("user_rosters")
    .select("roster")
    .eq("user_id", locals.user.id)
    .maybeSingle();

  if (err) {
    console.error("GET /api/roster failed:", err);
    throw error(500, "Internal server error");
  }

  return json({ roster: data?.roster ?? null });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  let roster: unknown;
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) throw new Error();
    roster = (body as Record<string, unknown>).roster;
  } catch {
    throw error(400, "Invalid roster payload");
  }

  if (!Array.isArray(roster)) {
    throw error(400, "Invalid roster payload");
  }
  if (roster.length > MAX_ROSTER_CHARACTERS) {
    throw error(
      400,
      `roster must have at most ${MAX_ROSTER_CHARACTERS} entries`,
    );
  }
  if (
    !roster.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { name_id?: unknown }).name_id === "string" &&
        (item as { name_id: string }).name_id.length > 0 &&
        (item as { name_id: string }).name_id.length <= MAX_NAME_ID_LENGTH &&
        typeof (item as { isOwned?: unknown }).isOwned === "boolean",
    )
  ) {
    throw error(400, "Invalid roster payload");
  }

  const { error: err } = await serverDb
    .from("user_rosters")
    .upsert(
      { user_id: locals.user.id, roster, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (err) {
    console.error("POST /api/roster failed:", err);
    throw error(500, "Internal server error");
  }

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const { error: err } = await serverDb
    .from("user_rosters")
    .delete()
    .eq("user_id", locals.user.id);

  if (err) {
    console.error("DELETE /api/roster failed:", err);
    throw error(500, "Internal server error");
  }

  return json({ ok: true });
};
