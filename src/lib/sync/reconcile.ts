/**
 * What to do when a server copy reaches an account's slot
 * (design: docs/design/account-sync.md).
 *
 * Pure: `decideReconcile` reads a slot and a server copy and returns a plan.
 * `createSyncedDoc` applies it (store the slot, empty the guest slot, ask,
 * queue a push). Every plan names the rule that produced it, so tests can
 * check the table directly and a trace can say why a slot changed.
 *
 * Rules, first match wins:
 *
 *   no server copy
 *     first-copy-from-guest  untouched account, guest data → send it
 *     first-upload           never had a server copy, data here → send it
 *     no-server-copy         keep data unsent; an agreed copy is `detached`
 *   server copy
 *     guest-asks / guest-merged  untouched account meets guest data
 *     attachment-owed        data matches but an attachment is unsent
 *     take-server            nothing unsent, or unsent edits match
 *     server-unmoved         the server is still at our base
 *     ask                    the spec wants the user to choose
 *     merged                 unsent edits merged onto the server copy
 */

import {
  baseOf,
  detached,
  revOf,
  tracked,
  type Ask,
  type SyncSlot,
} from "#lib/sync/slot.js";
import type { SyncedDocSpec } from "#lib/sync/synced-doc.js";

export type ReconcileRule =
  | "first-copy-from-guest"
  | "first-upload"
  | "no-server-copy"
  | "guest-asks"
  | "guest-merged"
  | "attachment-owed"
  | "take-server"
  | "server-unmoved"
  | "ask"
  | "merged";

export type ReconcileInput<T> = {
  slot: SyncSlot<T>;
  /**
   * The guest slot, or null when this response must not offer it. Null is
   * not an empty guest: an empty guest is a real document and can still be
   * compared. Null is never read and never cleared.
   */
  guest: SyncSlot<T> | null;
  /** The server's `field`, or null when it has no copy. */
  wire: unknown;
  rev: string | null;
  /**
   * `null` for a read, which never sends on its own. A number for a rejected
   * save: the retry count that save continues with.
   */
  continueSave: number | null;
  /** An attachment waits for this account's next write. */
  attachmentPending: boolean;
};

export type ReconcilePlan<T> = {
  rule: ReconcileRule;
  /** The account's new slot, or null to leave it as it is. */
  slot: SyncSlot<T> | null;
  /** Empty the guest slot: it has been offered to this account. */
  clearGuest: boolean;
  ask: Ask<T> | null;
  /** Queue a push with this retry count, or null for none. */
  push: number | null;
};

export function decideReconcile<T>(
  spec: SyncedDocSpec<T>,
  input: ReconcileInput<T>,
): ReconcilePlan<T> {
  const { slot, guest, wire, rev, continueSave } = input;

  // This device holds nothing of the account's own yet (first read here).
  const untouched =
    !slot.dirty &&
    slot.server.state === "unseen" &&
    spec.equal(slot.data, spec.empty());
  // A guest slot with an open question holds two copies. Offering it would
  // empty the slot and drop the other one, so it waits until answered.
  const offerGuest =
    guest !== null &&
    !guest.ask &&
    continueSave === null &&
    untouched &&
    !spec.equal(guest.data, spec.empty());

  const plan = (
    rule: ReconcileRule,
    parts: Partial<Omit<ReconcilePlan<T>, "rule">>,
  ): ReconcilePlan<T> => ({
    rule,
    slot: null,
    clearGuest: offerGuest,
    ask: null,
    push: null,
    ...parts,
  });
  /** A rejected save goes on while something is still unsent. */
  const continueIf = (dirty: boolean) =>
    dirty && continueSave !== null ? continueSave : null;

  if (wire === null || rev === null) {
    // No server copy: guest data becomes the account's first copy without
    // asking. There is nothing to overwrite or compare.
    if (offerGuest) {
      return plan("first-copy-from-guest", {
        slot: { ...slot, data: guest.data, dirty: true },
        push: 0,
      });
    }
    const dirty = slot.dirty || !spec.equal(slot.data, spec.empty());
    // A copy agreed on before is now `detached`, so a later read does not
    // take this device's copy for a first upload.
    const next = { ...slot, server: detached(slot.server), dirty };
    // Never saw a server copy: this is the account's first copy, sent
    // without asking.
    if (continueSave === null && slot.server.state === "unseen" && dirty) {
      return plan("first-upload", { slot: next, push: 0 });
    }
    return plan("no-server-copy", { slot: next, push: continueIf(dirty) });
  }

  const remote = spec.fromWire(wire, slot.data);

  // Guest data meets an account that already has a server copy. The spec
  // decides: a merge (kept unsent for the user to save) or "ask".
  if (offerGuest && !spec.equal(guest.data, remote)) {
    const merged = spec.merge(null, guest.data, remote);
    if (merged === "ask") {
      // The remote revision is not the agreed base until the user answers.
      // Recording it now would let a later read look unmoved and a Save
      // replace the server copy without asking again.
      return plan("guest-asks", {
        slot: {
          ...slot,
          data: guest.data,
          dirty: true,
          ask: { source: "server", remote, rev },
        },
        ask: { source: "server", remote, rev },
      });
    }
    return plan("guest-merged", {
      slot: {
        ...slot,
        data: merged,
        server: tracked(remote, rev),
        dirty: !spec.equal(merged, remote),
      },
    });
  }

  // Matching data still owes an unsent attachment (the GOOD inventory):
  // stay unsent on the new revision. A rejected save retries now; the push a
  // commit already queued finds the slot still dirty.
  if (slot.dirty && input.attachmentPending && spec.equal(slot.data, remote)) {
    return plan("attachment-owed", {
      slot: { ...slot, server: tracked(remote, rev) },
      push: continueIf(true),
    });
  }

  if (!slot.dirty || spec.equal(slot.data, remote)) {
    return plan("take-server", {
      slot: {
        ...slot,
        data: remote,
        server: tracked(remote, rev),
        dirty: false,
      },
    });
  }

  if (rev === revOf(slot.server)) {
    return plan("server-unmoved", { push: continueIf(true) });
  }

  const merged = spec.merge(baseOf(slot.server), slot.data, remote);
  if (merged === "ask") {
    return plan("ask", { ask: { source: "server", remote, rev } });
  }
  const dirty = !spec.equal(merged, remote) || input.attachmentPending;
  return plan("merged", {
    slot: { ...slot, data: merged, server: tracked(remote, rev), dirty },
    push: continueIf(dirty),
  });
}
