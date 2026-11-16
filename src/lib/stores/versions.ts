/**
 * Abyss / Stygian version numbers. Seeded from layout server data by
 * `setVersionNumbers()` (`#lib/stores/boards.js`) — no client-side fetch.
 *
 * Also holds the versions the applied static boards were fetched for, so
 * roster-keyed reads (`#lib/stores/teams.js`) can follow the board on screen
 * without importing the boards module. This module stays a leaf: the
 * reactions to a version change live in `setVersionNumbers()`, which sits
 * above both teams and boards.
 */

// ── Version numbers ────────────────────────────────────────────────────────
// Populated from layout server data — no client-side fetch needed.
export let abyssVersionNumber = -1;
export let stygianVersionNumber = -1;

/** Versions the current allTeams* stores were fetched for. */
export let staticBoardsAbyssVersion = -1;
export let staticBoardsStygianVersion = -1;

/** Written only by `#lib/stores/boards.js`. */
export function setStaticBoardsVersions(abyss: number, stygian: number): void {
  staticBoardsAbyssVersion = abyss;
  staticBoardsStygianVersion = stygian;
}

/**
 * Plain write of the layout version numbers. The public entry point is
 * `setVersionNumbers()` in `#lib/stores/boards.js`, which also invalidates
 * roster reads and marks the boards stale — call that, not this.
 */
export function writeVersionNumbers(abyss: number, stygian: number): void {
  abyssVersionNumber = abyss;
  stygianVersionNumber = stygian;
}

/** Roster-keyed fetches must never post the unseeded -1 sentinel. */
export function assertVersionsSeeded(): void {
  if (abyssVersionNumber < 0 || stygianVersionNumber < 0) {
    throw new Error(
      "[stores] version numbers not seeded — seedClientStores must run first",
    );
  }
}

export function versionsForRosterRequest(): { abyss: number; stygian: number } {
  if (staticBoardsAbyssVersion >= 0 && staticBoardsStygianVersion >= 0) {
    return {
      abyss: staticBoardsAbyssVersion,
      stygian: staticBoardsStygianVersion,
    };
  }
  return { abyss: abyssVersionNumber, stygian: stygianVersionNumber };
}
