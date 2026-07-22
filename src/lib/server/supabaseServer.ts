import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from "$env/static/public";
import { env } from "$env/dynamic/private";

/**
 * Server-only Supabase client.
 * Uses the service role key so it bypasses RLS — never expose to the client.
 * Falls back to the anon key if the service key isn't set (e.g. local dev).
 *
 * Lazy-init so private keys stay runtime-only (not baked into the Docker image).
 */
function createServerDb(): SupabaseClient<Database> {
  return createClient<Database>(
    PUBLIC_SUPABASE_URL,
    env.PRIVATE_SUPABASE_KEY || PUBLIC_SUPABASE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
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
