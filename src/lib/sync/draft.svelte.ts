/**
 * An editable draft over a synced document.
 *
 * Planner goals and the roster settings both edit a copy of stored data.
 * This owns that copy:
 *
 * - It follows the stored document while nothing is unsaved.
 * - Unsaved edits stay put when the stored document moves. Save merges them
 *   (`commit` with `basedOn`).
 * - Switching accounts drops the draft.
 * - Edits made while Save runs stay in the draft, unsaved.
 * - Cancel restores the current stored copy.
 *
 * Call during component initialization.
 */

import { untrack } from "svelte";
import { fromStore } from "svelte/store";
import type {
  CommitOutcome,
  SyncStatus,
  SyncedDoc,
} from "#lib/sync/synced-doc.js";

export type SyncedDraftOptions<T, D> = {
  /** Stored document → editor shape. */
  toDraft(data: T): D;
  /**
   * Editor shape → document. `baseline` is the stored document this draft
   * started from, so fields the editor does not show can be kept.
   */
  fromDraft(draft: D, baseline: T): T;
  /** Sync-relevant equality. Ignores device-only parts (a selection). */
  sameContent(a: D, b: D): boolean;
  /** Carry device-only parts across an adopt (the editor's selection). */
  keepLocal?(prev: D, next: D): D;
  /**
   * When true, the draft stays put as the stored copy moves. Goals use this
   * for staged removes, which live beside the document.
   */
  pinned?(): boolean;
  /** The account changed. Goals drop staged removes here. */
  onSwitch?(): void;
};

export type DraftSave = CommitOutcome & { kept: boolean };

export type SyncedDraft<T, D> = {
  /** The editor's copy. Assign to edit. */
  draft: D;
  /** The stored document this draft is based on. */
  readonly baseline: T;
  /** The stored document has been shown at least once. */
  readonly hydrated: boolean;
  /** The editor differs from its base (`sameContent`). */
  readonly unsaved: boolean;
  /** Stored edits the server has not accepted (`view.dirty`). */
  readonly unsent: boolean;
  readonly saving: boolean;
  readonly status: SyncStatus;
  readonly error: string | null;
  /**
   * Store and send the draft. `kept` means the submitted edit stayed in
   * the editor. It is false when this save did not take it.
   */
  save(): Promise<DraftSave>;
  /** Drop unsaved edits and show the current stored copy. */
  cancel(): void;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function useSyncedDraft<T, D = T>(
  doc: SyncedDoc<T>,
  opts: SyncedDraftOptions<T, D>,
): SyncedDraft<T, D> {
  const live = fromStore(doc.view);
  const initialData = clone(live.current.data);
  const initial = clone(opts.toDraft(initialData));

  let draft = $state(initial) as D;
  let base = $state(clone(initial)) as D;
  let baseDoc = $state(initialData) as T;
  let hydrated = $state(false);
  let saving = $state(false);
  /** Account the draft belongs to. `undefined` until the view has been shown. */
  let account: string | null | undefined = undefined;
  /** JSON of the projection last adopted, before `keepLocal`. */
  let followedKey = "";

  const unsaved = $derived(hydrated && !opts.sameContent(draft, base));

  function adopt(data: T) {
    const projected = opts.toDraft(data);
    // The follow key is the projection, so a detached editor copy cannot
    // disagree with the next run and adopt again.
    followedKey = JSON.stringify(projected);
    const detached = clone(projected);
    const current = untrack(() => draft);
    const kept = opts.keepLocal ? opts.keepLocal(current, detached) : detached;
    draft = kept;
    base = clone(kept);
    baseDoc = clone(data);
  }

  // Follow the stored document while there is nothing unsaved.
  $effect(() => {
    const view = live.current;
    const projected = opts.toDraft(view.data);
    if (view.status === "loading" && !untrack(() => hydrated)) return;
    const switched = view.account !== account;
    const pinned = opts.pinned?.() ?? false;
    if (switched) {
      account = view.account;
      opts.onSwitch?.();
    } else if (untrack(() => saving) || unsaved || pinned) {
      return;
    }
    const key = JSON.stringify(projected);
    if (switched || key !== followedKey) adopt(view.data);
    hydrated = true;
  });

  return {
    get draft() {
      return draft;
    },
    set draft(next) {
      draft = next;
    },
    get baseline() {
      return baseDoc;
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
      if (saving || live.current.account !== account) {
        return {
          status: "unchanged",
          account: live.current.account,
          kept: false,
        };
      }
      saving = true;
      const owner = account;
      try {
        // Capture before the await; edits made while it runs stay unsaved.
        // Inside the try so a throw still clears `saving`.
        const sent = clone(untrack(() => draft));
        const basedOn = clone(untrack(() => baseDoc));
        const payload = opts.fromDraft(sent, basedOn);
        const result = await doc.commit(payload, { basedOn });
        // An account switch already replaced the draft.
        if (account !== owner || result.account !== account) {
          return { ...result, kept: false };
        }
        // Edits made while this ran stay unsaved. The snapshot that was
        // submitted is their base, so that edit was kept.
        if (
          !opts.sameContent(
            untrack(() => draft),
            sent,
          )
        ) {
          base = sent;
          baseDoc = payload;
          return { ...result, kept: true };
        }
        // Ask / unchanged count as kept only when the stored copy is the
        // payload this save submitted (fromDraft may already have applied
        // removes).
        const submitted = opts.toDraft(payload);
        const kept =
          result.status === "sent" ||
          result.status === "local" ||
          result.status === "unsent" ||
          ((result.status === "unchanged" || result.status === "ask") &&
            opts.sameContent(opts.toDraft(live.current.data), submitted));
        if (kept) adopt(live.current.data);
        return { ...result, kept };
      } finally {
        saving = false;
      }
    },

    cancel() {
      if (live.current.account === account) adopt(live.current.data);
      else draft = clone(untrack(() => base));
    },
  };
}
