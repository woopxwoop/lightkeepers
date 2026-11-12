/**
 * The roster synced document for this tab
 * (design: docs/design/account-sync.md).
 *
 * The one entry point for roster data. The root layout calls `setAccount`,
 * `refresh`, `feedRosterStores`, and `watchRosterConflicts`. Settings saves
 * call `rosterSync().commit`. Pages keep reading `charactersOwned`, which is
 * fed from here; nothing else writes it, reads roster storage, or calls
 * `/api/roster` to save.
 */

import { get } from "svelte/store";
import type { Character } from "#lib/definitions.js";
import {
  charactersHydrated,
  charactersOwned,
  hasSavedRoster,
} from "#lib/stores.js";
import {
  parseRosterDoc,
  rosterDocSpec,
  rosterOwnedFrom,
  type RosterDoc,
} from "#lib/sync/roster-doc.js";
import {
  browserSlotStorage,
  memorySlotStorage,
  type SlotStorage,
} from "#lib/sync/storage.js";
import {
  createSyncedDoc,
  type SyncedDoc,
  type SyncView,
} from "#lib/sync/synced-doc.js";
import { fetchTransport, type SyncTransport } from "#lib/sync/transport.js";
import {
  cancelRosterSyncConflict,
  promptRosterSyncConflict,
} from "#lib/app/roster-sync-conflict.js";

/** Keys from before per-account slots. Read once, then removed. */
const LEGACY_ROSTER_KEY = "charactersOwned";
const LEGACY_OWNER_KEY = "rosterOwnerUserId";
const LEGACY_SAVED_FLAG_KEY = "hasSavedRoster";

/**
 * Move the old single-key roster into a slot, once.
 *
 * The old code stamped the account that last stored the roster
 * (`rosterOwnerUserId`). A stamped roster goes to that account's slot as
 * unsent: its next read takes the server copy when they match, asks when
 * they differ, and sends it when the account has no server copy, which is
 * what the old sign-in sync did. An unstamped roster goes to the guest slot.
 * An existing slot is never overwritten.
 */
export function migrateLegacyRoster(storage: SlotStorage): void {
  const legacy = parseRosterDoc(storage.read(LEGACY_ROSTER_KEY));
  if (legacy.length > 0) {
    const rawOwner = storage.read(LEGACY_OWNER_KEY);
    // The owner was stored as a bare string, which is not JSON.
    const owner = typeof rawOwner === "string" ? rawOwner : null;
    const key = `lk:${rosterDocSpec.key}:${owner ?? "guest"}`;
    if (storage.read(key) === null) {
      storage.write(key, {
        v: rosterDocSpec.schemaVersion,
        data: legacy,
        base: null,
        baseRev: null,
        dirty: owner !== null,
      });
    }
  }
  storage.remove(LEGACY_ROSTER_KEY);
  storage.remove(LEGACY_OWNER_KEY);
  storage.remove(LEGACY_SAVED_FLAG_KEY);
}

/** Reads the bare owner string the old code stored (not JSON). */
function legacyAwareStorage(storage: SlotStorage): SlotStorage {
  return {
    ...storage,
    read(key) {
      if (key !== LEGACY_OWNER_KEY) return storage.read(key);
      try {
        const value = localStorage.getItem(key);
        return value && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    },
  };
}

const offlineTransport: SyncTransport = {
  read: async () => ({ status: "error", message: "unavailable" }),
  write: async () => ({ status: "error", message: "unavailable" }),
};

let instance: SyncedDoc<RosterDoc> | null = null;

/** This tab's roster document. Server renders get a fresh, inert one. */
export function rosterSync(): SyncedDoc<RosterDoc> {
  if (typeof window === "undefined") {
    return createSyncedDoc(rosterDocSpec, {
      storage: memorySlotStorage(),
      transport: offlineTransport,
    });
  }
  if (!instance) {
    const storage = browserSlotStorage();
    migrateLegacyRoster(legacyAwareStorage(storage));
    instance = createSyncedDoc(rosterDocSpec, {
      storage,
      transport: fetchTransport(rosterDocSpec.endpoint, rosterDocSpec.field),
    });
  }
  return instance;
}

let fedJson = "";

/**
 * Publish the active account's roster to the stores pages read. Waits until
 * the session is known, so pages never see a placeholder roster first.
 * `hasSavedRoster` is "this slot holds a saved roster": the default roster
 * is never stored.
 */
export function feedRosterStores(
  characters: Character[],
  view: SyncView<RosterDoc>,
): void {
  if (!view.ready) return;
  const json = JSON.stringify([characters.length, view.account, view.data]);
  if (json !== fedJson || !get(charactersHydrated)) {
    fedJson = json;
    charactersOwned.set(rosterOwnedFrom(characters, view.data));
  }
  hasSavedRoster.set(view.data.length > 0);
  charactersHydrated.set(true);
}

/**
 * Show the conflict popup whenever the roster asks, and answer the document
 * with the choice. "Dismiss" leaves the question open: this device's copy
 * stays unsent, and the next Save answers it. A failed upload reopens the
 * popup with the error.
 */
export function watchRosterConflicts(
  characters: () => Character[],
): () => void {
  const sync = rosterSync();
  /** Account + server copy already shown, so one question shows once. */
  let shown = "";

  async function ask(view: SyncView<RosterDoc>) {
    const remote = view.remote;
    if (!remote) return;
    const choice = await promptRosterSyncConflict(
      rosterOwnedFrom(characters(), view.data),
      rosterOwnedFrom(characters(), remote),
    );
    if (get(sync.view).account !== view.account) return;
    if (choice === "use-cloud") {
      await sync.resolve("remote");
      return;
    }
    if (choice !== "upload-local") return;
    await sync.resolve("local");
    let error = get(sync.view).error;
    while (error && get(sync.view).account === view.account) {
      const retry = await promptRosterSyncConflict(
        rosterOwnedFrom(characters(), get(sync.view).data),
        [],
        error,
        { uploadRetry: true },
      );
      if (retry !== "upload-local") return;
      await sync.commit(get(sync.view).data);
      error = get(sync.view).error;
    }
  }

  let account: string | null | undefined;
  return sync.view.subscribe((view) => {
    if (view.account !== account) {
      account = view.account;
      shown = "";
      cancelRosterSyncConflict();
    }
    if (view.status !== "ask" || !view.remote) return;
    const key = JSON.stringify([view.account, view.remote]);
    if (key === shown) return;
    shown = key;
    void ask(view);
  });
}
