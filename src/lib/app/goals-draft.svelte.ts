/**
 * A page's editable copy of the calculator goals.
 *
 * Planner, itinerary, and audit all edit goals through this. The synced
 * document (`goals-sync.ts`) owns storage, accounts, and the server. The
 * shared draft (`draft.svelte.ts`) owns following that document; this adds
 * staged removes, which are applied on Save.
 *
 * Call during component initialization.
 */

import { goalsSync, revealGoalsConflict } from "#lib/app/goals-sync.js";
import { parseGoalsState } from "#lib/calculator-goals.js";
import { goalsWithoutPendingRemoves } from "#lib/calculator-goals-lifecycle.js";
import { captureGoals } from "#lib/calculator-goals-snapshot.js";
import { useSyncedDraft } from "#lib/sync/draft.svelte.js";
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

function sameGoals(a: CalculatorGoalsState, b: CalculatorGoalsState): boolean {
  return (
    JSON.stringify(parseGoalsState(a).goals) ===
    JSON.stringify(parseGoalsState(b).goals)
  );
}

export function useGoalsDraft(): GoalsDraft {
  let pendingRemoveIds = $state(new Set<string>());
  /** Account switches since init. A save that spans one does not report success. */
  let switches = 0;

  const sync = useSyncedDraft(goalsSync(), {
    toDraft: (data) => data,
    fromDraft: (draft) => goalsWithoutPendingRemoves(draft, pendingRemoveIds),
    sameContent: sameGoals,
    keepLocal: (prev, next) => withSelection(next, prev.selectedId),
    pinned: () => pendingRemoveIds.size > 0,
    onSwitch: () => {
      pendingRemoveIds = new Set();
      switches += 1;
    },
  });

  return {
    get state() {
      return sync.draft;
    },
    set state(next) {
      sync.draft = next;
    },
    get pendingRemoveIds() {
      return pendingRemoveIds;
    },
    set pendingRemoveIds(next) {
      pendingRemoveIds = next;
    },
    get savedJson() {
      return sync.hydrated ? captureGoals(sync.baseline).json : "";
    },
    get hydrated() {
      return sync.hydrated;
    },
    get unsaved() {
      return sync.unsaved || (sync.hydrated && pendingRemoveIds.size > 0);
    },
    get unsent() {
      return sync.unsent;
    },
    get saving() {
      return sync.saving;
    },
    get status() {
      return sync.status;
    },
    get error() {
      return sync.error;
    },

    async save() {
      const mark = switches;
      const sentRemoves = new Set(pendingRemoveIds);
      if (sentRemoves.size > 0) {
        sync.draft = goalsWithoutPendingRemoves(sync.draft, sentRemoves);
      }
      const result = await sync.save();
      // A switch already dropped the draft and the staged removes.
      if (switches !== mark) return false;
      pendingRemoveIds = new Set(
        [...pendingRemoveIds].filter((id) => !sentRemoves.has(id)),
      );
      if (result.status === "ask") {
        revealGoalsConflict();
        return false;
      }
      return result.status === "sent" || result.status === "local";
    },

    cancel() {
      pendingRemoveIds = new Set();
      sync.cancel();
    },
  };
}
