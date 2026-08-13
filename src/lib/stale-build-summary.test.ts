import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isStaleBuildSummary } from "./stale-build-summary.ts";

const ids = new Set(["Hutao", "PlayerBoy", "Qin"]);

describe("isStaleBuildSummary", () => {
  it("matches kit name_id", () => {
    assert.equal(isStaleBuildSummary("Hutao", ids), true);
    assert.equal(isStaleBuildSummary("Qin", ids), true);
    assert.equal(isStaleBuildSummary("Ayaka", ids), false);
  });

  it("strips Traveler element suffixes", () => {
    assert.equal(isStaleBuildSummary("PlayerBoy", ids), true);
    assert.equal(isStaleBuildSummary("PlayerBoy-Anemo", ids), true);
    assert.equal(isStaleBuildSummary("PlayerGirl-Pyro", ids), false);
  });

  it("rejects empty ids", () => {
    assert.equal(isStaleBuildSummary(null, ids), false);
    assert.equal(isStaleBuildSummary("", ids), false);
  });
});
