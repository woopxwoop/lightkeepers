/**
 * Login sync runs for a later guest → user transition and for a direct
 * account switch. Logout and the first settled id stay quiet.
 *
 * Run: pnpm exec tsx --test src/lib/app/bootstrap-session.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  missingCloudRosterNeedsConfirm,
  rememberRosterOwner,
  retainUnownedRosterOnLogout,
  shouldSyncCloudRoster,
} from "./bootstrapClient.ts";

describe("shouldSyncCloudRoster", () => {
  it("skips the first settled id", () => {
    assert.equal(shouldSyncCloudRoster(undefined, "user-a"), false);
    assert.equal(shouldSyncCloudRoster(undefined, null), false);
  });

  it("syncs when a settled guest signs in or the account id changes", () => {
    assert.equal(shouldSyncCloudRoster(null, "user-a"), true);
    assert.equal(shouldSyncCloudRoster("user-a", "user-b"), true);
  });

  it("does not sync logout, the first settled id, or a repeat of the same id", () => {
    assert.equal(shouldSyncCloudRoster("user-a", null), false);
    assert.equal(shouldSyncCloudRoster("user-a", "user-a"), false);
    assert.equal(shouldSyncCloudRoster(null, null), false);
  });
});

describe("missingCloudRosterNeedsConfirm", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );

  afterEach(() => {
    if (originalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  function installLocalStorage(): Map<string, string> {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, String(value));
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
    return storage;
  }

  it("asks on a direct switch when no owner was recorded", () => {
    installLocalStorage();
    assert.equal(missingCloudRosterNeedsConfirm("user-b", true), true);
    assert.equal(missingCloudRosterNeedsConfirm("user-b", false), false);
  });

  it("asks when the recorded owner is another account", () => {
    installLocalStorage();
    rememberRosterOwner("user-a");
    assert.equal(missingCloudRosterNeedsConfirm("user-b", false), true);
    assert.equal(missingCloudRosterNeedsConfirm("user-a", true), false);
  });

  it("binds an unowned roster to the account that logged out", () => {
    installLocalStorage();
    retainUnownedRosterOnLogout("user-a");
    assert.equal(missingCloudRosterNeedsConfirm("user-b", false), true);
    assert.equal(missingCloudRosterNeedsConfirm("user-a", false), false);
  });

  it("leaves a roster that already has an owner on logout", () => {
    installLocalStorage();
    rememberRosterOwner("user-a");
    retainUnownedRosterOnLogout("user-b");
    assert.equal(missingCloudRosterNeedsConfirm("user-a", true), false);
    assert.equal(missingCloudRosterNeedsConfirm("user-c", false), true);
  });
});
