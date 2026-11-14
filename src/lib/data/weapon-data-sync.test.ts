/**
 * Run: pnpm exec tsx --test src/lib/data/weapon-data-sync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import weaponIndex from "./weapon-index.json" with { type: "json" };
import weaponRefinements from "./weapon-refinements.json" with { type: "json" };
import weapons from "./weapons.json" with { type: "json" };

const STALE = "derived weapon data is stale — run `node split-weapon-data.mjs`";

describe("weapon-index.json / weapon-refinements.json", () => {
  it("match the split of weapons.json", () => {
    const expectedIndex = weapons.map(
      ({ refinements: _refinements, ...rest }) => rest,
    );
    const expectedRefinements: Record<string, unknown> = {};
    for (const weapon of weapons) {
      if (weapon.refinements?.length) {
        expectedRefinements[weapon.id] = weapon.refinements;
      }
    }

    assert.deepEqual(weaponIndex, expectedIndex, STALE);
    assert.deepEqual(weaponRefinements, expectedRefinements, STALE);
  });
});
