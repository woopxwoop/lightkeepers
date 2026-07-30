import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSTELLATION_UPGRADE,
  classifyUpgradeImpact,
  primaryUpgradePct,
  type UpgradeImpactLadder,
} from "./upgrade-priority.ts";

describe("upgrade priority", () => {
  it("uses the stronger of mean and median", () => {
    assert.equal(primaryUpgradePct(8.2, 11.4), 11.4);
    assert.equal(primaryUpgradePct(16.1, 9.3), 16.1);
  });

  it("classifies against a five-band ladder", () => {
    assert.equal(
      classifyUpgradeImpact(31, CONSTELLATION_UPGRADE).tier,
      "exceptional",
    );
    assert.equal(classifyUpgradeImpact(22, CONSTELLATION_UPGRADE).tier, "high");
    assert.equal(classifyUpgradeImpact(14, CONSTELLATION_UPGRADE).tier, "solid");
    assert.equal(classifyUpgradeImpact(7, CONSTELLATION_UPGRADE).tier, "modest");
    assert.equal(
      classifyUpgradeImpact(2, CONSTELLATION_UPGRADE).tier,
      "negligible",
    );
  });

  it("supports custom labels and thresholds", () => {
    const ladder: UpgradeImpactLadder = [
      { minPct: 5, tier: "high", label: "Worth it" },
      { minPct: 0, tier: "negligible", label: "Optional" },
    ];

    assert.deepEqual(classifyUpgradeImpact(6, ladder), {
      tier: "high",
      label: "Worth it",
    });
    assert.deepEqual(classifyUpgradeImpact(1, ladder), {
      tier: "negligible",
      label: "Optional",
    });
  });
});
