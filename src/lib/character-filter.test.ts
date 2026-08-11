import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterAndSortCharacters } from "./character-filter.ts";
import type { CharacterOwned } from "./definitions.ts";

function char(
  partial: Partial<CharacterOwned> & Pick<CharacterOwned, "name_id" | "game_id">,
): CharacterOwned {
  return {
    created_at: "",
    element: "Cryo",
    name: partial.name_id,
    rarity: 5,
    released_at: null,
    weapon_type: "WEAPON_SWORD_ONE_HAND",
    isOwned: true,
    ...partial,
  };
}

describe("filterAndSortCharacters release_date", () => {
  const alyosha = char({
    name_id: "Alyosha",
    name: "Alyosha",
    game_id: 10000148,
    released_at: null,
    element: "Electro",
  });
  const odette = char({
    name_id: "Odette",
    name: "Odette",
    game_id: 10000150,
    released_at: null,
  });
  const traveler = char({
    name_id: "PlayerBoy",
    name: "Traveler",
    game_id: 10000005,
    released_at: null,
    element: null,
  });
  const hutao = char({
    name_id: "Hutao",
    name: "Hu Tao",
    game_id: 10000046,
    released_at: "2021-03-02T00:00:00.000Z",
    element: "Pyro",
  });
  const skirk = char({
    name_id: "Skirk",
    name: "Skirk",
    game_id: 10000114,
    released_at: "2025-06-18T00:00:00.000Z",
    element: "Cryo",
  });

  it("pins empty released_at first when newest-first, excluding Traveler", () => {
    const ordered = filterAndSortCharacters(
      [hutao, traveler, odette, skirk, alyosha],
      { sortBy: "release_date", sortAsc: false },
    ).map((c) => c.name_id);

    assert.deepEqual(ordered.slice(0, 2).sort(), ["Alyosha", "Odette"]);
    assert.equal(ordered[2], "Skirk");
    assert.equal(ordered[3], "Hutao");
    assert.equal(ordered[4], "PlayerBoy");
  });

  it("still pins unreleased first when oldest-first", () => {
    const ordered = filterAndSortCharacters(
      [skirk, alyosha, traveler, hutao],
      { sortBy: "release_date", sortAsc: true },
    ).map((c) => c.name_id);

    assert.equal(ordered[0], "Alyosha");
    assert.equal(ordered[1], "PlayerBoy");
    assert.equal(ordered[2], "Hutao");
    assert.equal(ordered[3], "Skirk");
  });
});
