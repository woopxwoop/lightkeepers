import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dev } from "$app/environment";
import type { Database } from "$lib/types/database.types";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from "$env/static/public";
import { env } from "$env/dynamic/private";

/**
 * Server-only Supabase client.
 * Uses the service role key so it bypasses RLS — never expose to the client.
 * Falls back to the anon key only in `vite dev` when the service key isn't set.
 * Production / `node build` refuse to start without PRIVATE_SUPABASE_KEY.
 *
 * Lazy-init so private keys stay runtime-only (not baked into the Docker image).
 */
function serviceRoleKey(): string {
  const key = env.PRIVATE_SUPABASE_KEY;
  if (key) return key;
  if (dev) return PUBLIC_SUPABASE_KEY;
  throw new Error(
    "Missing PRIVATE_SUPABASE_KEY — required outside vite dev (service role bypasses RLS)",
  );
}

function createServerDb(): SupabaseClient<Database> {
  return createClient<Database>(PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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
