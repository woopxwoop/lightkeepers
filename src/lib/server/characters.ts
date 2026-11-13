/**
 * The characters table — single loader for every server consumer.
 *
 * `charactersCache` (L1 + Valkey) holds one entry, so every caller must agree
 * on what that entry is: name-ordered rows, Playwright fixtures under e2e.
 * Two loaders writing the same key with different queries means whichever
 * runs first after expiry decides what the other serves for 15 minutes.
 */
import { error } from "@sveltejs/kit";
import { serverDb } from "#lib/server/supabaseServer.js";
import { charactersCache } from "#lib/server/cache.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import { e2eCharacters } from "#lib/e2e/fixtures.js";
import type { Tables } from "#lib/types/database.types.js";

// Bumped from "characters" so a pre-fix unordered L2 entry is never read back.
const CACHE_KEY = "characters:by-name";

/** All characters ordered by name (cached; generic 500 on DB error). */
export function loadCharacters(): Promise<Tables<"characters">[]> {
  return charactersCache.getOrSet(CACHE_KEY, async () => {
    if (isPlaywrightE2e()) return e2eCharacters();
    const { data, error: err } = await serverDb
      .from("characters")
      .select("*")
      .order("name", { ascending: true });
    if (err) {
      console.error("loadCharacters:", err);
      // Throw so the cache is not poisoned with [] for 15m. Generic message —
      // never surface PostgREST details to the client.
      throw error(500, "Failed to load characters.");
    }
    return data ?? [];
  });
}
