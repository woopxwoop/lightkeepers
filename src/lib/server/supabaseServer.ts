import { createClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from "$env/static/public";
import { PRIVATE_SUPABASE_KEY } from "$env/static/private";

/**
 * Server-only Supabase client.
 * Uses the service role key so it bypasses RLS — never expose to the client.
 * Falls back to the anon key if the service key isn't set (e.g. local dev).
 */
export const serverDb = createClient<Database>(
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_KEY ?? PUBLIC_SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
