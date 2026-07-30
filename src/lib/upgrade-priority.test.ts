import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSTELLATION_UPGRADE,
  LEVEL_UPGRADE,
  SIGNATURE_UPGRADE,
  TALENT_UPGRADE,
  classifyUpgradeImpact,
  primaryUpgradePct,
  type UpgradeImpactLadder,
} from "./upgrade-priority.ts";

/** Fixture ladder so tuning the shipped thresholds can't break these tests. */
const ladder: UpgradeImpactLadder = [
  { minPct: 30, tier: "exceptional", label: "Exceptional" },
  { minPct: 20, tier: "high", label: "High" },
  { minPct: 10, tier: "solid", label: "Solid" },
  { minPct: 5, tier: "modest", label: "Modest" },
  { minPct: 0, tier: "negligible", label: "Negligible" },
];

describe("upgrade priority", () => {
  it("uses the stronger of mean and median", () => {
    assert.equal(primaryUpgradePct(8.2, 11.4), 11.4);
    assert.equal(primaryUpgradePct(16.1, 9.3), 16.1);
  });

  it("picks the first band at or below the value", () => {
    assert.deepEqual(classifyUpgradeImpact(31, ladder), {
      tier: "exceptional",
      label: "Exceptional",
    });
    assert.equal(classifyUpgradeImpact(22, ladder).tier, "high");
    assert.equal(classifyUpgradeImpact(14, ladder).tier, "solid");
    assert.equal(classifyUpgradeImpact(7, ladder).tier, "modest");
    assert.equal(classifyUpgradeImpact(2, ladder).tier, "negligible");
  });

  it("treats band bounds as inclusive", () => {
    assert.equal(classifyUpgradeImpact(30, ladder).tier, "exceptional");
    assert.equal(classifyUpgradeImpact(29.9, ladder).tier, "high");
  });

  it("classifies drops by magnitude", () => {
    assert.equal(classifyUpgradeImpact(-22, ladder).tier, "high");
  });

  it("throws when a ladder has no zero-percent band", () => {
    assert.throws(() =>
      classifyUpgradeImpact(1, [{ minPct: 5, tier: "high", label: "High" }]),
    );
  });

  it("ships ladders that descend and cover zero", () => {
    const shipped = {
      TALENT_UPGRADE,
      LEVEL_UPGRADE,
      CONSTELLATION_UPGRADE,
      SIGNATURE_UPGRADE,
    };

    for (const [name, bands] of Object.entries(shipped)) {
      const thresholds = bands.map((band) => band.minPct);
      assert.deepEqual(
        thresholds,
        [...thresholds].sort((a, b) => b - a),
        `${name} bands must be ordered high → low`,
      );
      assert.equal(thresholds.at(-1), 0, `${name} must end at 0%`);
    }
  });
});
