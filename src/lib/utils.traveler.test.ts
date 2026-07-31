/**
 * Unit tests for Traveler element-split GOOD / sim keys.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGoodKeyMap,
  ownedGoodKeys,
  simCharacterKey,
  travelerElementKey,
} from "./utils.ts";

describe("travelerElementKey / simCharacterKey", () => {
  it("maps kit element to Traveler{Element}", () => {
    assert.equal(travelerElementKey("Pyro"), "TravelerPyro");
    assert.equal(travelerElementKey("anemo"), "TravelerAnemo");
    assert.equal(travelerElementKey("Cryo"), null);
  });

  it("uses Traveler{Element} for traveler kits and toGoodKey otherwise", () => {
    assert.equal(
      simCharacterKey({
        name: "Traveler",
        element: "Pyro",
        is_traveler: true,
      }),
      "TravelerPyro",
    );
    assert.equal(
      simCharacterKey({
        name: "Traveler",
        is_traveler: true,
      }),
      "TravelerPyro",
    );
    assert.equal(
      simCharacterKey({
        name: "Traveler",
        element: "Cryo",
        is_traveler: true,
      }),
      "TravelerPyro",
    );
    assert.equal(
      simCharacterKey({ name: "Hu Tao", is_traveler: false }),
      "HuTao",
    );
  });
});

describe("buildGoodKeyMap / ownedGoodKeys traveler fan-out", () => {
  it("registers every Traveler{Element} onto the roster Traveler row", () => {
    const traveler = { name: "Traveler", isOwned: true };
    const map = buildGoodKeyMap([traveler]);
    assert.equal(map.get("Traveler"), traveler);
    assert.equal(map.get("TravelerPyro"), traveler);
    assert.equal(map.get("TravelerAnemo"), traveler);

    const owned = ownedGoodKeys([traveler]);
    assert.ok(owned.has("Traveler"));
    assert.ok(owned.has("TravelerPyro"));
    assert.ok(owned.has("TravelerDendro"));
  });
});
