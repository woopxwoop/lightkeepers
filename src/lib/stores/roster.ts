/**
 * Roster stores. No fetch here: the root layout feeds them from the roster
 * synced document (`rosterSync()` in `#lib/app/roster-sync.js`, which talks to
 * /api/roster). Read-only elsewhere.
 */

import { writable } from "svelte/store";
import type { CharacterOwned } from "#lib/definitions.js";

// ── Character store ────────────────────────────────────────────────────────
// Fed from the roster synced document by the root layout. Read-only elsewhere.
export const charactersOwned = writable<CharacterOwned[]>([]);
export const charactersHydrated = writable<boolean>(false);

/**
 * The active account's roster slot holds a saved roster (the default roster
 * is never stored). Fed by `feedRosterStores` (`#lib/app/roster-sync.js`).
 */
export const hasSavedRoster = writable<boolean>(false);
