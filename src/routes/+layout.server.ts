/**
 * +layout.server.ts
 *
 * Runs on the server for every page render (SSR + subsequent navigations).
 * Version numbers come from tiny table lookups — not /api/static — so home
 * SSR is not blocked on the heavy all-teams RPCs. Full boards warm client-side
 * via ensureStaticBoards().
 *
 * Ships `characters` once; `+layout.ts` rebuilds the name_id Map for the client.
 */

import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { charactersCache } from "$lib/server/cache";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { e2eCharacters, e2eStaticPayload } from "$lib/e2e/fixtures";
import { listPatchNotes } from "$lib/patch-notes-catalog";
import {
  getLatestAbyssVersionNumber,
  getLatestStygianVersionNumber,
} from "$lib/server/version-validation";

export const load: LayoutServerLoad = async () => {
  const [versions, characters] = await Promise.all([
    (async () => {
      if (isPlaywrightE2e()) {
        const payload = e2eStaticPayload();
        return {
          abyssVersionNumber: payload.latestAbyssVersion.version_number,
          stygianVersionNumber: payload.latestStygianVersion.version_number,
        };
      }

      const [abyssVersionNumber, stygianVersionNumber] = await Promise.all([
        getLatestAbyssVersionNumber(),
        getLatestStygianVersionNumber(),
      ]);

      // Fail closed — never stamp -1 into client stores from an empty table.
      if (abyssVersionNumber == null || stygianVersionNumber == null) {
        console.error("layout: missing latest abyss/stygian version", {
          abyssVersionNumber,
          stygianVersionNumber,
        });
        throw error(500, "Failed to load version numbers.");
      }

      return { abyssVersionNumber, stygianVersionNumber };
    })(),
    charactersCache.getOrSet("characters", async () => {
      if (isPlaywrightE2e()) return e2eCharacters();
      const { data, error: err } = await serverDb
        .from("characters")
        .select("*")
        .order("name", { ascending: true });
      if (err) {
        console.error("layout: characters error", err);
        // Throw so charactersCache does not poison L1 with [] for 15m.
        // Generic message — never surface PostgREST details to the client.
        throw error(500, "Failed to load characters.");
      }
      return data ?? [];
    }),
  ]);

  // Skip in Playwright so the popup never blocks e2e flows.
  const latest = isPlaywrightE2e() ? undefined : listPatchNotes()[0];
  const latestPatchNote = latest
    ? {
        slug: latest.slug,
        title: latest.title,
        date: latest.date,
        summary: latest.summary,
      }
    : null;

  return {
    characters,
    abyssVersionNumber: versions.abyssVersionNumber,
    stygianVersionNumber: versions.stygianVersionNumber,
    latestPatchNote,
  };
};
