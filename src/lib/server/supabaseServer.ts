import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dev } from "$app/env";
import type { Database } from "#lib/types/database.types.js";
import { withDeadline } from "#lib/cdn-fetch.js";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from "$app/env/public";
import { PRIVATE_SUPABASE_KEY } from "$app/env/private";

/**
 * Server-only Supabase client.
 * Uses the service role key so it bypasses RLS — never expose to the client.
 * Falls back to the anon key only in `vite dev` when the service key isn't set.
 * Outside vite dev, missing PRIVATE_SUPABASE_KEY throws on first DB access
 * (lazy init — the process can still boot; the first query fails closed).
 *
 * Lazy-init so private keys stay runtime-only (not baked into the Docker image).
 */
function serviceRoleKey(): string {
  const key = PRIVATE_SUPABASE_KEY;
  if (key) return key;
  if (dev) return PUBLIC_SUPABASE_KEY;
  throw new Error(
    "Missing PRIVATE_SUPABASE_KEY — required outside vite dev (service role bypasses RLS)",
  );
}

/**
 * Ceiling for any single PostgREST request. Cold /api/static loads take ~2 s;
 * without a deadline a stalled request waits on Node's ~5 min socket limits,
 * and LRUCache.getOrSet coalesces every caller for that key behind it — one
 * stuck query becomes a route-wide outage until it settles.
 */
const SERVER_DB_TIMEOUT_MS = 20_000;

function createServerDb(): SupabaseClient<Database> {
  return createClient<Database>(PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { fetch: withDeadline(fetch, SERVER_DB_TIMEOUT_MS) },
  });
}

let _serverDb: SupabaseClient<Database> | undefined;

function getServerDb(): SupabaseClient<Database> {
  return (_serverDb ??= createServerDb());
}

export const serverDb: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, _receiver) {
      const client = getServerDb();
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
