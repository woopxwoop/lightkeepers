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
  /**
   * No cloud roster exists (or upload of local failed before any cloud row).
   * Dialog omits “Use cloud”; upload-local retries the upload.
   */
  uploadRetry: boolean;
  resolve: (choice: RosterSyncChoice) => void;
};

export const rosterSyncConflict = writable<RosterSyncConflict | null>(null);

/** Show the conflict dialog and wait for the user's choice. */
export function promptRosterSyncConflict(
  local: CharacterOwned[],
  cloud: CharacterOwned[],
  error: string | null = null,
  opts?: { uploadRetry?: boolean },
): Promise<RosterSyncChoice> {
  const previous = get(rosterSyncConflict);
  if (previous) {
    previous.resolve("dismiss");
  }

  const uploadRetry = opts?.uploadRetry === true;

  return new Promise((resolve) => {
    const conflict: RosterSyncConflict = {
      local,
      cloud,
      error,
      uploadRetry,
      resolve: (choice) => {
        // Only clear if this conflict is still the active one — a newer prompt
        // may have already replaced the store entry.
        if (get(rosterSyncConflict) === conflict) {
          rosterSyncConflict.set(null);
        }
        resolve(choice);
      },
    };
    rosterSyncConflict.set(conflict);
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
