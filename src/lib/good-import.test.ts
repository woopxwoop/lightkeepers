import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGoodRoster,
  parseGoodRoster,
  parseGoodText,
} from "./good-import.ts";
import type { CharacterOwned } from "./definitions.ts";

function char(name: string, name_id: string, isOwned: boolean): CharacterOwned {
  return { name, name_id, isOwned, progress: null } as CharacterOwned;
}

describe("parseGoodRoster", () => {
  it("reads IGOOD characters and equipped weapons from any source", () => {
    const parsed = parseGoodRoster({
      format: "GOOD",
      version: 3,
      source: "Enka.Network",
      characters: [
        {
          key: "HuTao",
          level: 90,
          constellation: 2,
          ascension: 6,
          talent: { auto: 6, skill: 9, burst: 8 },
          id: "HuTao",
        },
        { key: "TravelerPyro", level: 80, constellation: 0, ascension: 6 },
      ],
      weapons: [
        {
          key: "StaffOfHoma",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "HuTao",
          lock: false,
        },
        {
          key: "DullBlade",
          level: 1,
          ascension: 0,
          refinement: 1,
          location: "",
          lock: false,
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const hutao = parsed.characters.get("HuTao");
    assert.equal(hutao?.constellation, 2);
    assert.equal(hutao?.talents.skill, 9);
    assert.equal(hutao?.weapon?.key, "StaffOfHoma");
    assert.equal(parsed.characters.get("TravelerPyro")?.level, 80);
    assert.equal(parsed.weapons.length, 2);
    assert.equal(parsed.weapons[1]?.key, "DullBlade");
    assert.equal(parsed.weapons[1]?.location, "");
    assert.equal(parsed.artifacts.length, 0);
  });

  it("clamps GOOD spec ranges that exceed planner caps", () => {
    const parsed = parseGoodRoster({
      format: "GOOD",
      source: "Genshin Optimizer",
      characters: [
        {
          key: "Zhongli",
          level: 100,
          constellation: 6,
          ascension: 6,
          talent: { auto: 15, skill: 13, burst: 12 },
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const zhongli = parsed.characters.get("Zhongli");
    assert.equal(zhongli?.level, 90);
    assert.deepEqual(zhongli?.talents, { normal: 10, skill: 10, burst: 10 });
  });

  it("accepts talent.normal as an alias for talent.auto", () => {
    const parsed = parseGoodRoster({
      format: "GOOD",
      characters: [
        {
          key: "Beidou",
          talent: { normal: 4, skill: 5, burst: 6 },
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.characters.get("Beidou")?.talents, {
      normal: 4,
      skill: 5,
      burst: 6,
    });
  });

  it("infers owned characters from equipped weapons when the list is empty", () => {
    const parsed = parseGoodRoster({
      format: "GOOD",
      characters: [],
      weapons: [
        {
          key: "WolfFang",
          level: 90,
          ascension: 6,
          refinement: 5,
          location: "Furina",
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.characters.get("Furina")?.weapon?.key, "WolfFang");
    assert.equal(parsed.weapons[0]?.location, "Furina");
  });

  it("keeps artifacts including unequipped pieces", () => {
    const parsed = parseGoodRoster({
      format: "GOOD",
      characters: [{ key: "HuTao", level: 90, constellation: 0, ascension: 6 }],
      artifacts: [
        {
          setKey: "CrimsonWitchOfFlames",
          slotKey: "goblet",
          level: 20,
          rarity: 5,
          mainStatKey: "pyro_dmg_",
          location: "HuTao",
          lock: true,
          substats: [{ key: "critRate_", value: 10.5 }],
          unactivatedSubstats: [
            { key: "", value: 0 },
            { key: "eleMas", value: 16 },
            { key: "", value: 0 },
            { key: "", value: 0 },
          ],
        },
        {
          setKey: "WanderersTroupe",
          slotKey: "flower",
          level: 0,
          rarity: 5,
          mainStatKey: "hp",
          location: "",
          lock: false,
          substats: [],
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.artifacts.length, 2);
    assert.equal(parsed.artifacts[0]?.location, "HuTao");
    assert.deepEqual(parsed.artifacts[0]?.unactivatedSubstats, [
      { key: "eleMas", value: 16 },
    ]);
    assert.equal(parsed.artifacts[1]?.location, "");
  });

  it("rejects missing format or empty files", () => {
    assert.equal(parseGoodRoster(null).ok, false);
    assert.equal(parseGoodRoster({ characters: [] }).ok, false);
    assert.equal(parseGoodRoster({ format: "GOOD", characters: [] }).ok, false);
  });
});

describe("parseGoodText", () => {
  it("parses a GOOD JSON string", () => {
    const parsed = parseGoodText(
      JSON.stringify({
        format: "GOOD",
        version: 3,
        characters: [
          { key: "HuTao", level: 90, constellation: 0, ascension: 6 },
        ],
      }),
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.characters.get("HuTao")?.level, 90);
  });

  it("rejects invalid JSON text", () => {
    const parsed = parseGoodText("{");
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.match(parsed.message, /JSON/);
  });
});

describe("applyGoodRoster", () => {
  it("owns listed characters with progress and unowns the rest", () => {
    const roster = [
      char("Hu Tao", "Hutao", true),
      char("Beidou", "Beidou", true),
      char("Traveler", "PlayerBoy", false),
      char("Qiqi", "Qiqi", true),
    ];
    const parsed = parseGoodRoster({
      format: "GOOD",
      characters: [
        {
          key: "HuTao",
          level: 90,
          constellation: 1,
          ascension: 6,
          talent: { auto: 8, skill: 8, burst: 8 },
        },
        { key: "TravelerPyro", level: 70, constellation: 0, ascension: 5 },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const next = applyGoodRoster(roster, parsed.characters);
    assert.equal(next[0]?.isOwned, true);
    assert.equal(next[0]?.progress?.constellation, 1);
    assert.equal(next[1]?.isOwned, false);
    assert.equal(next[1]?.progress, null);
    assert.equal(next[2]?.isOwned, true);
    assert.equal(next[2]?.progress?.level, 70);
    assert.equal(next[3]?.isOwned, false);
  });
});
