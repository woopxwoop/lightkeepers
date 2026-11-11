/**
 * Login sync runs only for a later guest → user transition.
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

  it("syncs when a settled guest signs in", () => {
    assert.equal(shouldSyncCloudRoster(null, "user-a"), true);
  });

  it("does not sync logout, account switch, or a repeat of the same id", () => {
    assert.equal(shouldSyncCloudRoster("user-a", null), false);
    assert.equal(shouldSyncCloudRoster("user-a", "user-b"), false);
    assert.equal(shouldSyncCloudRoster("user-a", "user-a"), false);
    assert.equal(shouldSyncCloudRoster(null, null), false);
  });
});
