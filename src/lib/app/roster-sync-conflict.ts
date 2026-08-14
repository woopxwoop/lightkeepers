/**
 * Pending local↔cloud roster conflict during login bootstrap.
 * UI resolves via promptRosterSyncConflict; dismiss leaves both sides unchanged.
 */

import { writable } from "svelte/store";
import type { CharacterOwned } from "$lib/definitions";

export type RosterSyncChoice = "use-cloud" | "upload-local" | "dismiss";

export type RosterSyncConflict = {
  local: CharacterOwned[];
  cloud: CharacterOwned[];
  /** Set when a prior upload failed and the dialog reopened for retry. */
  error: string | null;
  resolve: (choice: RosterSyncChoice) => void;
};

export const rosterSyncConflict = writable<RosterSyncConflict | null>(null);

/** Show the conflict dialog and wait for the user's choice. */
export function promptRosterSyncConflict(
  local: CharacterOwned[],
  cloud: CharacterOwned[],
  error: string | null = null,
): Promise<RosterSyncChoice> {
  return new Promise((resolve) => {
    rosterSyncConflict.set({
      local,
      cloud,
      error,
      resolve: (choice) => {
        rosterSyncConflict.set(null);
        resolve(choice);
      },
    });
  });
}

/** Drop any leftover conflict UI (e.g. account changed after a choice). */
export function cancelRosterSyncConflict(): void {
  rosterSyncConflict.set(null);
}
