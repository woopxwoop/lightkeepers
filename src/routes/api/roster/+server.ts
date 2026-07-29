import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import {
  MAX_NAME_ID_LENGTH,
  MAX_ROSTER_CHARACTERS,
} from "$lib/server/request-validation";

type RosterEntry = { name_id: string; isOwned: boolean };

function parseAndNormalizeRoster(raw: unknown): RosterEntry[] {
  if (!Array.isArray(raw)) {
    throw error(400, "Invalid roster payload");
  }
  if (raw.length > MAX_ROSTER_CHARACTERS) {
    throw error(
      400,
      `roster must have at most ${MAX_ROSTER_CHARACTERS} entries`,
    );
  }

  const normalized: RosterEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw error(400, "Invalid roster payload");
    }
    const keys = Object.keys(item);
    if (
      keys.length !== 2 ||
      !keys.includes("name_id") ||
      !keys.includes("isOwned")
    ) {
      throw error(400, "Invalid roster payload");
    }
    const { name_id, isOwned } = item as Record<string, unknown>;
    if (
      typeof name_id !== "string" ||
      name_id.length === 0 ||
      name_id.length > MAX_NAME_ID_LENGTH ||
      typeof isOwned !== "boolean"
    ) {
      throw error(400, "Invalid roster payload");
    }
    normalized.push({ name_id, isOwned });
  }
  return normalized;
}

export const GET: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
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

export const POST: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
  if (!locals.user) throw error(401, "Unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid roster payload");
  }
  if (typeof body !== "object" || body === null) {
    throw error(400, "Invalid roster payload");
  }

  const roster = parseAndNormalizeRoster(
    (body as Record<string, unknown>).roster,
  );

  const { error: err } = await serverDb
    .from("user_rosters")
    .upsert(
      {
        user_id: locals.user.id,
        roster,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (err) {
    console.error("POST /api/roster failed:", err);
    throw error(500, "Internal server error");
  }

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({
  locals,
  request,
  getClientAddress,
}) => {
  await enforceApiRateLimit({ request, getClientAddress });
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
