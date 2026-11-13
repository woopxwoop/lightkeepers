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
import { decodeSlot, type SyncSlot } from "#lib/sync/slot.js";
import {
  browserSlotStorage,
  memorySlotStorage,
  retainUntilStored,
  type SlotStorage,
} from "#lib/sync/storage.js";
import {
  createSyncedDoc,
  type SyncedDoc,
  type SyncView,
} from "#lib/sync/synced-doc.js";
import {
  fetchTransport,
  type SyncTransport,
  type WriteReport,
} from "#lib/sync/transport.js";
import {
  cancelRosterSyncConflict,
  promptRosterSyncConflict,
} from "#lib/app/roster-sync-conflict.js";
import { clearRosterInventory } from "#lib/app/roster-inventory.js";

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
 * An existing slot keeps its entries; legacy characters it does not already
 * contain are added. A slot that does not decode as a roster is replaced.
 * The old keys are removed only once the slot is stored, so a full storage
 * keeps the roster for the next load.
 * When the slot cannot be stored, the migrated slot is returned so this tab
 * shows it until a write succeeds.
 */
export function migrateLegacyRoster(
  storage: SlotStorage,
): { key: string; slot: SyncSlot<RosterDoc> } | null {
  const legacy = parseRosterDoc(storage.read(LEGACY_ROSTER_KEY));
  if (legacy.length > 0) {
    const rawOwner = storage.read(LEGACY_OWNER_KEY);
    // The owner was stored as a bare string, which is not JSON.
    const owner = typeof rawOwner === "string" ? rawOwner : null;
    const key = `lk:${rosterDocSpec.key}:${owner ?? "guest"}`;
    const fresh: SyncSlot<RosterDoc> = {
      v: rosterDocSpec.schemaVersion,
      data: legacy,
      dirty: owner !== null,
      server: { state: "unseen" },
    };
    const existing = storage.read(key);
    if (existing === null) {
      const stored = storage.write(key, fresh);
      if (!stored) return { key, slot: fresh };
    } else {
      const slot = decodeSlot(
        existing,
        parseRosterDoc,
        () => [],
        rosterDocSpec.schemaVersion,
      );
      const ids = new Set(slot.data.map((entry) => entry.name_id));
      const missing = legacy.filter((entry) => !ids.has(entry.name_id));
      if (missing.length > 0) {
        const merged: SyncSlot<RosterDoc> = {
          ...slot,
          data: parseRosterDoc([...slot.data, ...missing]),
          dirty: slot.dirty || owner !== null,
        };
        const stored = storage.write(key, merged);
        if (!stored) return { key, slot: merged };
      }
    }
  }
  storage.remove(LEGACY_ROSTER_KEY);
  storage.remove(LEGACY_OWNER_KEY);
  storage.remove(LEGACY_SAVED_FLAG_KEY);
  return null;
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

/** The roster route names a dropped inventory attachment `inventoryOmitted`. */
function rosterWriteReport(body: Record<string, unknown>): WriteReport {
  return { attachmentOmitted: body.inventoryOmitted === true };
}

const offlineTransport: SyncTransport = {
  read: async () => ({ status: "error", message: "unavailable" }),
  write: async () => ({ status: "error", message: "unavailable" }),
  remove: async () => ({ status: "error", message: "unavailable" }),
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
    const pending = migrateLegacyRoster(legacyAwareStorage(storage));
    instance = createSyncedDoc(rosterDocSpec, {
      storage: pending
        ? retainUntilStored(storage, pending.key, pending.slot)
        : storage,
      transport: fetchTransport(
        rosterDocSpec.endpoint,
        rosterDocSpec.field,
        rosterWriteReport,
      ),
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
  const json = JSON.stringify([characters, view.account, view.data]);
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
  /** Account + server copy already prompted, while that conflict is still open. */
  let shown = "";

  async function ask(view: SyncView<RosterDoc>) {
    const remote = view.remote;
    if (!remote) return;
    const choice = await promptRosterSyncConflict(
      rosterOwnedFrom(characters(), view.data),
      rosterOwnedFrom(characters(), remote),
      null,
      { savedCopy: view.remoteSource === "device" },
    );
    if (get(sync.view).account !== view.account) return;
    if (choice === "use-cloud") {
      // The cached GOOD slices belong to the roster being replaced. Drop
      // them before taking the server copy so the next read fetches it.
      // A device-vs-device question is not the server inventory.
      if (view.remoteSource !== "device") clearRosterInventory();
      await sync.resolve("remote");
      return;
    }
    if (choice !== "upload-local") return;
    let result = await sync.resolve("local");
    while (
      result.status === "unsent" &&
      result.account === get(sync.view).account
    ) {
      const retry = await promptRosterSyncConflict(
        rosterOwnedFrom(characters(), get(sync.view).data),
        [],
        result.error,
        { uploadRetry: true },
      );
      if (retry !== "upload-local") return;
      if (get(sync.view).account !== view.account) return;
      result = await sync.commit(get(sync.view).data);
    }
  }

  let account: string | null | undefined;
  return sync.view.subscribe((view) => {
    if (view.account !== account) {
      account = view.account;
      shown = "";
      cancelRosterSyncConflict();
    }
    // Dedup only while this conflict is still unanswered. Once status
    // leaves `ask`, the same server copy must be able to ask again.
    if (view.status !== "ask") {
      shown = "";
      return;
    }
    if (!view.remote) return;
    const key = JSON.stringify([view.account, view.data, view.remote]);
    if (key === shown) return;
    shown = key;
    void ask(view);
  });
}
