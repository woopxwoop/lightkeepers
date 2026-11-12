/**
 * Login sync runs for a later guest → user transition and for a direct
 * account switch. Logout and the first settled id stay quiet.
 *
 * Run: pnpm exec tsx --test src/lib/app/bootstrap-session.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSyncCloudRoster } from "./bootstrapClient.ts";

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
