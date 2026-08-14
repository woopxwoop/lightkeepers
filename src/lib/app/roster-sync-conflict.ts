/**
 * Pending local↔cloud roster conflict during login bootstrap.
 * UI resolves via promptRosterSyncConflict; dismiss leaves both sides unchanged.
 */

import { get, writable } from "svelte/store";
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
  const previous = get(rosterSyncConflict);
  if (previous) {
    previous.resolve("dismiss");
  }

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

/**
 * Close a pending conflict (e.g. account changed while the popup is open).
 * Resolves the waiter as dismiss so bootstrap does not apply either side.
 */
export function cancelRosterSyncConflict(): void {
  const pending = get(rosterSyncConflict);
  if (!pending) return;
  pending.resolve("dismiss");
}
