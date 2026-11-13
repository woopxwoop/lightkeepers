/**
 * Per-account slot persistence for synced documents.
 *
 * The engine keeps slots in memory and treats storage as a best-effort copy:
 * a failed write leaves the in-memory slot in charge for this tab.
 */

export interface SlotStorage {
  /** Parsed JSON at `key`, or null when missing, unreadable, or not JSON. */
  read(key: string): unknown;
  /** False when the value could not be stored (quota, privacy mode). */
  write(key: string, value: unknown): boolean;
  remove(key: string): void;
  /**
   * Another tab changed `key`. `value` is the new parsed JSON (null if
   * removed). Returns an unsubscribe function.
   */
  watch(onChange: (key: string, value: unknown) => void): () => void;
}

function parseJson(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** `localStorage` with `storage` events for cross-tab changes. */
export function browserSlotStorage(): SlotStorage {
  return {
    read(key) {
      try {
        return parseJson(localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* unreadable storage has nothing to remove */
      }
    },
    watch(onChange) {
      if (typeof window === "undefined") return () => {};
      const listener = (event: StorageEvent) => {
        if (event.storageArea !== localStorage || event.key == null) return;
        onChange(event.key, parseJson(event.newValue));
      };
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    },
  };
}

/**
 * Serve `value` at `key` until that key is stored. A failed migration write
 * uses this so the tab shows the migrated document instead of an empty one.
 * A later successful write of the key drops the hold and runs `onStored`,
 * so the caller can drop legacy keys only after the slot is really stored.
 */
export function retainUntilStored(
  storage: SlotStorage,
  key: string,
  value: unknown,
  onStored?: () => void,
): SlotStorage {
  let retained: unknown = value;
  return {
    read(k) {
      if (k === key && retained !== undefined && storage.read(k) === null) {
        return retained;
      }
      return storage.read(k);
    },
    write(k, v) {
      const ok = storage.write(k, v);
      if (ok && k === key && retained !== undefined) {
        retained = undefined;
        onStored?.();
      }
      return ok;
    },
    remove(k) {
      if (k === key) retained = undefined;
      storage.remove(k);
    },
    watch(onChange) {
      return storage.watch((k, v) => {
        if (k === key) retained = undefined;
        onChange(k, v);
      });
    },
  };
}

/** In-memory storage for tests and SSR. `emit` simulates another tab. */
export function memorySlotStorage(): SlotStorage & {
  entries: Map<string, string>;
  emit(key: string, value: unknown): void;
  failWrites: boolean;
} {
  const entries = new Map<string, string>();
  const listeners = new Set<(key: string, value: unknown) => void>();
  const storage = {
    entries,
    failWrites: false,
    read(key: string) {
      return parseJson(entries.get(key) ?? null);
    },
    write(key: string, value: unknown) {
      if (storage.failWrites) return false;
      entries.set(key, JSON.stringify(value));
      return true;
    },
    remove(key: string) {
      entries.delete(key);
    },
    watch(onChange: (key: string, value: unknown) => void) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    emit(key: string, value: unknown) {
      entries.set(key, JSON.stringify(value));
      for (const listener of listeners) listener(key, value);
    },
  };
  return storage;
}
