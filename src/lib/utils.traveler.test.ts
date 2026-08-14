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
  plannerSimKey,
  simCharacterKey,
  travelerElementKey,
  uiAssetNameId,
  isOwnedNameId,
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

describe("uiAssetNameId / isOwnedNameId / plannerSimKey", () => {
  it("strips Traveler element suffixes for UI art stems", () => {
    assert.equal(uiAssetNameId("PlayerBoy-Anemo"), "PlayerBoy");
    assert.equal(uiAssetNameId("PlayerGirl-Hydro"), "PlayerGirl");
    assert.equal(uiAssetNameId("Hutao"), "Hutao");
  });

  it("treats every Traveler element as owned when PlayerBoy is owned", () => {
    const owned = new Set(["PlayerBoy", "Hutao"]);
    assert.equal(isOwnedNameId("PlayerBoy-Anemo", owned), true);
    assert.equal(isOwnedNameId("PlayerBoy-Cryo", owned), true);
    assert.equal(isOwnedNameId("Hutao", owned), true);
    assert.equal(isOwnedNameId("Ayaka", owned), false);
  });

  it("maps planner name_ids to Traveler{Element} builds keys", () => {
    assert.equal(plannerSimKey("PlayerBoy-Anemo"), "TravelerAnemo");
    assert.equal(plannerSimKey("PlayerBoy-Cryo"), "TravelerCryo");
    assert.equal(plannerSimKey("Hutao", "Hu Tao"), "HuTao");
  });
});
