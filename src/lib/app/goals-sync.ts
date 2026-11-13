/**
 * The calculator-goals synced document for this tab
 * (design: docs/design/account-sync.md).
 *
 * The one entry point for goals data. Pages read `goalsSync().view` through
 * `useGoalsDraft` (`goals-draft.svelte.ts`), and the root layout calls
 * `setAccount` when the session settles. Nothing else reads or writes goal
 * storage or calls `/api/calculator-goals`.
 */

import { parseGoalsState } from "#lib/calculator-goals.js";
import { goalsDocSpec } from "#lib/sync/goals-doc.js";
import {
  browserSlotStorage,
  memorySlotStorage,
  retainUntilStored,
  type SlotStorage,
} from "#lib/sync/storage.js";
import type { SyncSlot } from "#lib/sync/slot.js";
import { createSyncedDoc, type SyncedDoc } from "#lib/sync/synced-doc.js";
import { fetchTransport, type SyncTransport } from "#lib/sync/transport.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";

/** Keys from before per-account slots. Read once, then removed. */
const LEGACY_GOALS_KEY = "calculatorGoals";
const LEGACY_RECOVERY_KEY = "calculatorGoalsRecovery";

/**
 * Move the old single-key goals into a slot, once.
 *
 * The old key had no owner. A failed-read recovery record names the account
 * whose edits were still unsent, so those goals go to that account's slot as
 * unsent (a read merges them, the user saves). Otherwise they go to the
 * guest slot: an account with no server copy adopts them on sign-in, the
 * same as the old first upload. An existing slot is never overwritten.
 *
 * The recovery record's `baseJson` is the copy both sides last agreed on.
 * It becomes the slot's `detached` base (no revision is known), so the first read keeps local deletes
 * and lets newer cloud changes win over untouched goals.
 *
 * The old keys are removed only once the slot is stored. A full storage
 * leaves them for the next load instead of losing the goals. When the slot
 * cannot be stored, the migrated slot is returned so this tab can show it
 * until a write succeeds — an empty in-memory guest would let a later save
 * create a slot and the next load would then delete the legacy copy.
 */
export function migrateLegacyGoals(
  storage: SlotStorage,
): { key: string; slot: SyncSlot<CalculatorGoalsState> } | null {
  const legacy = storage.read(LEGACY_GOALS_KEY);
  if (legacy !== null) {
    const recovery = storage.read(LEGACY_RECOVERY_KEY) as {
      userId?: unknown;
      baseJson?: unknown;
    } | null;
    const owner =
      typeof recovery?.userId === "string" && recovery.userId.length > 0
        ? recovery.userId
        : null;
    const key = `lk:${goalsDocSpec.key}:${owner ?? "guest"}`;
    if (storage.read(key) === null) {
      const base =
        owner !== null ? legacyRecoveryBase(recovery?.baseJson) : null;
      const slot: SyncSlot<CalculatorGoalsState> = {
        v: goalsDocSpec.schemaVersion,
        data: parseGoalsState(legacy),
        dirty: owner !== null,
        // The agreed copy is known, its revision is not.
        server: base ? { state: "detached", base } : { state: "unseen" },
      };
      const stored = storage.write(key, slot);
      if (!stored) return { key, slot };
    }
  }
  storage.remove(LEGACY_GOALS_KEY);
  storage.remove(LEGACY_RECOVERY_KEY);
  return null;
}

/** The old recovery record's agreed copy, or null when unreadable. */
function legacyRecoveryBase(baseJson: unknown): CalculatorGoalsState | null {
  if (typeof baseJson !== "string" || baseJson.length === 0) return null;
  try {
    return parseGoalsState(JSON.parse(baseJson) as unknown);
  } catch {
    return null;
  }
}

/** SSR renders the loading state; it never reads or sends. */
const offlineTransport: SyncTransport = {
  read: async () => ({ status: "error", message: "unavailable" }),
  write: async () => ({ status: "error", message: "unavailable" }),
};

let instance: SyncedDoc<CalculatorGoalsState> | null = null;

/** This tab's goals document. Server renders get a fresh, inert one. */
export function goalsSync(): SyncedDoc<CalculatorGoalsState> {
  if (typeof window === "undefined") {
    return createSyncedDoc(goalsDocSpec, {
      storage: memorySlotStorage(),
      transport: offlineTransport,
    });
  }
  if (!instance) {
    const storage = browserSlotStorage();
    const pending = migrateLegacyGoals(storage);
    instance = createSyncedDoc(goalsDocSpec, {
      storage: pending
        ? retainUntilStored(storage, pending.key, pending.slot)
        : storage,
      transport: fetchTransport(goalsDocSpec.endpoint, goalsDocSpec.field),
    });
  }
  return instance;
}
