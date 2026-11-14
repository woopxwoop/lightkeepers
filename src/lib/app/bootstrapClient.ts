/**
 * Client bootstrap after layout SSR.
 *
 * seedClientStores — sync, safe during SSR/hydration (version numbers).
 * bootstrapClient — onMount only: warm /api/static.
 *
 * The roster is not bootstrapped here. It is a synced document
 * (`#lib/app/roster-sync.js`): the root layout points it at the session and
 * feeds `charactersOwned` from it. Owned teams stay lazy (Abyss / Stygian /
 * Pulls call ensureTeamsOwned).
 */

import { ensureStaticBoards } from "#lib/stores/boards.js";
import { setVersionNumbers } from "#lib/stores/boards.js";

type LayoutHydration = {
  abyssVersionNumber: number;
  stygianVersionNumber: number;
};

/** Client-side version numbers from root layout SSR data. */
export function seedClientStores(data: LayoutHydration): void {
  setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber);
}

/**
 * Seeds layout stores and warms the meta team boards in the background so
 * home → /tools/abyss|stygian navigation is snappy.
 */
export function bootstrapClient(data: LayoutHydration): void {
  seedClientStores(data);
  // Fire early — do not await; home stays interactive while boards warm.
  // Failures land in staticBoardsPhase for Abyss/Stygian retry UI.
  // Investment JSON is loaded on Teams / character routes (not every visit).
  void ensureStaticBoards();
}
