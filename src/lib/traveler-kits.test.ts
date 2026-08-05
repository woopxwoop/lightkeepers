/**
 * Unit tests for Traveler multi-element kit helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CharacterKit } from "./types/character-kit.ts";
import {
  availableTravelerElements,
  defaultTravelerElement,
  mergeTravelerKits,
  travelerElementKitId,
} from "./traveler-kits.ts";

function stubKit(
  partial: Partial<CharacterKit> & Pick<CharacterKit, "name_id" | "element">,
): CharacterKit {
  return {
    game_id: 1,
    name: "Traveler",
    weapon_type: "WEAPON_SWORD_ONE_HAND",
    rarity: 5,
    released_at: null,
    is_traveler: true,
    title: "",
    association: "ASSOC_TYPE_MAINACTOR",
    birthday: null,
    assets: {
      portrait: "",
      coop: "",
      card: "",
      gacha: "",
      namecard: "",
      side: "",
    },
    skills: [],
    passives: [],
    constellations: [],
    ...partial,
  };
}

describe("travelerElementKitId", () => {
  it("joins name_id and element", () => {
    assert.equal(travelerElementKitId("PlayerBoy", "Cryo"), "PlayerBoy-Cryo");
  });
});

describe("mergeTravelerKits", () => {
  it("keeps elemental files and fills base.element when missing", () => {
    const base = stubKit({ name_id: "PlayerBoy", element: "Pyro" });
    const anemo = stubKit({ name_id: "PlayerBoy-Anemo", element: "Anemo" });
    const merged = mergeTravelerKits(base, { Anemo: anemo });
    assert.equal(merged.Anemo, anemo);
    assert.equal(merged.Pyro, base);
    assert.equal(merged.Cryo, undefined);
  });

  it("prefers elemental file over base for the same element", () => {
    const base = stubKit({ name_id: "PlayerBoy", element: "Pyro" });
    const pyro = stubKit({ name_id: "PlayerBoy-Pyro", element: "Pyro" });
    const merged = mergeTravelerKits(base, { Pyro: pyro });
    assert.equal(merged.Pyro, pyro);
  });
});

describe("defaultTravelerElement", () => {
  it("prefers the base element when available", () => {
    const kits = {
      Anemo: stubKit({ name_id: "PlayerBoy-Anemo", element: "Anemo" }),
      Pyro: stubKit({ name_id: "PlayerBoy", element: "Pyro" }),
    };
    assert.equal(defaultTravelerElement(kits, "Pyro"), "Pyro");
  });

  it("falls back to first available in release order", () => {
    const kits = {
      Cryo: stubKit({ name_id: "PlayerBoy-Cryo", element: "Cryo" }),
      Anemo: stubKit({ name_id: "PlayerBoy-Anemo", element: "Anemo" }),
    };
    assert.equal(defaultTravelerElement(kits, null), "Anemo");
    assert.deepEqual(availableTravelerElements(kits), ["Anemo", "Cryo"]);
  });
});
