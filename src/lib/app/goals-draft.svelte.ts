/**
 * A page's editable copy of the calculator goals.
 *
 * Planner, itinerary, and audit all edit goals through this. The synced
 * document (`goals-sync.ts`) owns storage, accounts, and the server; this
 * owns only the UI draft:
 *
 * - The draft follows the stored goals until the user changes something.
 * - Unsaved changes stay put when the stored goals move. Save merges them
 *   onto the newer goals (`commit` with `basedOn`), so nothing is replaced.
 * - Switching accounts drops the draft. One account's edits never save as
 *   another's.
 * - Removes are staged in `pendingRemoveIds` and applied on Save.
 *
 * Call during component initialization.
 */

import { untrack } from "svelte";
import { fromStore } from "svelte/store";
import { goalsSync } from "#lib/app/goals-sync.js";
import { emptyGoalsState, parseGoalsState } from "#lib/calculator-goals.js";
import {
  goalsHaveUnsavedChanges,
  goalsWithoutPendingRemoves,
} from "#lib/calculator-goals-lifecycle.js";
import { captureGoals } from "#lib/calculator-goals-snapshot.js";
import type { SyncStatus } from "#lib/sync/synced-doc.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";

export type GoalsDraft = {
  /** The editor's goals. Assign to edit. */
  state: CalculatorGoalsState;
  /** Staged removes, applied on Save. */
  pendingRemoveIds: Set<string>;
  /** JSON of the stored goals the draft started from. */
  readonly savedJson: string;
  /** The stored goals have been shown at least once. */
  readonly hydrated: boolean;
  /** The goal list differs from what is stored (selection does not count). */
  readonly unsaved: boolean;
  /** Stored edits the server has not accepted. Save sends them. */
  readonly unsent: boolean;
  readonly saving: boolean;
  readonly status: SyncStatus;
  /** Why the last read or send failed, if it did. */
  readonly error: string | null;
  /** Store and send the draft. False when it could not be sent. */
  save(): Promise<boolean>;
  /** Drop unsaved edits and staged removes. */
  cancel(): void;
};

/** Keep the editor's selection when the goal still exists. */
function withSelection(
  next: CalculatorGoalsState,
  selectedId: string | null,
): CalculatorGoalsState {
  return selectedId && next.goals.some((goal) => goal.id === selectedId)
    ? { ...next, selectedId }
    : next;
}

export function useGoalsDraft(): GoalsDraft {
  const sync = goalsSync();
  const live = fromStore(sync.view);

  let state = $state<CalculatorGoalsState>(emptyGoalsState());
  let savedJson = $state("");
  let pendingRemoveIds = $state(new Set<string>());
  let hydrated = $state(false);
  let saving = $state(false);
  /** Account the draft belongs to. */
  let account: string | null | undefined = undefined;

  const unsaved = $derived(
    goalsHaveUnsavedChanges({
      hydrated,
      state,
      savedSnapshot: savedJson,
      pendingRemoveIds,
    }),
  );

  function adopt(data: CalculatorGoalsState) {
    const stored = captureGoals(data);
    state = withSelection(
      stored.state,
      untrack(() => state.selectedId),
    );
    savedJson = stored.json;
  }

  // Follow the stored goals while there is nothing unsaved.
  $effect(() => {
    const view = live.current;
    if (view.status === "loading" && !untrack(() => hydrated)) return;
    const switched = view.account !== account;
    if (switched) {
      account = view.account;
      pendingRemoveIds = new Set();
    } else if (untrack(() => unsaved || saving)) {
      return;
    }
    if (switched || captureGoals(view.data).json !== untrack(() => savedJson)) {
      adopt(view.data);
    }
    hydrated = true;
  });

  return {
    get state() {
      return state;
    },
    set state(next) {
      state = next;
    },
    get pendingRemoveIds() {
      return pendingRemoveIds;
    },
    set pendingRemoveIds(next) {
      pendingRemoveIds = next;
    },
    get savedJson() {
      return savedJson;
    },
    get hydrated() {
      return hydrated;
    },
    get unsaved() {
      return unsaved;
    },
    get unsent() {
      return live.current.dirty;
    },
    get saving() {
      return saving;
    },
    get status() {
      return live.current.status;
    },
    get error() {
      return live.current.error;
    },

    async save() {
      if (saving || live.current.account !== account) return false;
      saving = true;
      try {
        const next = captureGoals(
          goalsWithoutPendingRemoves(state, pendingRemoveIds),
        ).state;
        const basedOn = savedJson
          ? parseGoalsState(JSON.parse(savedJson) as unknown)
          : undefined;
        await sync.commit(next, { basedOn });
        pendingRemoveIds = new Set();
        adopt(live.current.data);
        return live.current.error === null;
      } finally {
        saving = false;
      }
    },

    cancel() {
      if (savedJson) {
        state = parseGoalsState(JSON.parse(savedJson) as unknown);
      }
      pendingRemoveIds = new Set();
    },
  };
}
