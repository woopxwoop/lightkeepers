/**
 * Pending local↔cloud roster conflict during login bootstrap.
 * UI resolves via promptRosterSyncConflict; Escape keeps local without uploading.
 */

import { writable } from "svelte/store";
import type { CharacterOwned } from "$lib/definitions";

export type RosterSyncChoice = "use-cloud" | "upload-local" | "keep-local";

export type RosterSyncConflict = {
  local: CharacterOwned[];
  cloud: CharacterOwned[];
  resolve: (choice: RosterSyncChoice) => void;
};

export const rosterSyncConflict = writable<RosterSyncConflict | null>(null);

/** Show the conflict dialog and wait for the user's choice. */
export function promptRosterSyncConflict(
  local: CharacterOwned[],
  cloud: CharacterOwned[],
): Promise<RosterSyncChoice> {
  return new Promise((resolve) => {
    rosterSyncConflict.set({
      local,
      cloud,
      resolve: (choice) => {
        rosterSyncConflict.set(null);
        resolve(choice);
      },
    });
  });
}
