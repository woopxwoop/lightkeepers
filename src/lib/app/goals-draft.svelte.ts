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
import { useSyncedDraft, type DraftSave } from "#lib/sync/draft.svelte.js";
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
  /**
   * Store and send the draft. `kept` means this edit stayed in the editor.
   * `sent` and `local` are the ones a page treats as saved.
   */
  save(): Promise<DraftSave>;
  /**
   * Show `next`, then save it. Restores the editor when this account's save
   * did not keep the edit. An account switch leaves the new account's draft
   * alone and resolves `null`.
   */
  apply(next: CalculatorGoalsState): Promise<DraftSave | null>;
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
      // An overlapping save returns unchanged without taking this payload.
      // Reject it before the draft or the staged ids change.
      if (sync.saving) {
        return { status: "unchanged", account: null, kept: false };
      }
      const sentRemoves = new Set(pendingRemoveIds);
      const result = await sync.save();
      // A switch already dropped the draft and the staged removes. The
      // editor now shows another account, so this save is not reported as
      // saved there.
      if (switches !== mark) {
        return { status: "unchanged", account: result.account, kept: false };
      }
      // A staged remove is done only when this save kept the edit and the
      // goal is gone from the editor. The draft decides `kept`.
      if (result.kept) {
        pendingRemoveIds = new Set(
          [...pendingRemoveIds].filter((id) => {
            if (!sentRemoves.has(id)) return true;
            return sync.draft.goals.some((goal) => goal.id === id);
          }),
        );
      }
      if (result.status === "ask") revealGoalsConflict();
      return result;
    },

    async apply(next) {
      const mark = switches;
      const previous = sync.draft;
      sync.draft = next;
      const owned = sync.revision;
      try {
        const result = await this.save();
        // The switch already installed the new account's draft.
        if (switches !== mark) return null;
        // An edit or Cancel during this save replaced the editor copy.
        if (!result.kept && sync.revision === owned && sameGoals(sync.draft, next)) {
          sync.draft = previous;
        }
        return result;
      } catch (err) {
        if (
          switches === mark &&
          sync.revision === owned &&
          sameGoals(sync.draft, next)
        ) {
          sync.draft = previous;
        }
        throw err;
      }
    },

    cancel() {
      pendingRemoveIds = new Set();
      sync.cancel();
    },
  };
}
