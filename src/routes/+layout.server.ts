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

import type { LayoutServerLoad } from "./$types";
import { loadCharacters } from "#lib/server/characters.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import { e2eStaticPayload } from "#lib/e2e/fixtures.js";
import { listPatchNotes } from "#lib/patch-notes/patch-notes-catalog.js";
import { getLayoutVersionNumbers } from "#lib/server/version-validation.js";

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

      // Null (never -1) when a version table errors or is empty: pages still
      // render and the client takes versions from /api/static instead.
      const { abyss, stygian } = await getLayoutVersionNumbers();
      return { abyssVersionNumber: abyss, stygianVersionNumber: stygian };
    })(),
    loadCharacters(),
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
