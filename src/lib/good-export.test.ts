import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeGoodDocument } from "./good-export.ts";
import type { CharacterOwned } from "./definitions.ts";

describe("serializeGoodDocument", () => {
  it("rebuilds IGOOD with source Lightkeepers and omits materials", () => {
    const roster = [
      {
        name: "Hu Tao",
        name_id: "Hutao",
        isOwned: true,
        progress: {
          level: 90,
          ascension: 6,
          constellation: 1,
          talents: { normal: 6, skill: 8, burst: 8 },
          weapon: null,
        },
      },
      { name: "Qiqi", name_id: "Qiqi", isOwned: false },
    ] as CharacterOwned[];
    const doc = serializeGoodDocument({
      roster,
      weapons: [
        {
          key: "StaffOfHoma",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "HuTao",
          lock: false,
        },
      ],
      artifacts: [],
    });
    assert.equal(doc.format, "GOOD");
    assert.equal(doc.source, "Lightkeepers");
    assert.equal(doc.version, 3);
    assert.equal(doc.characters?.length, 1);
    assert.equal(doc.characters?.[0]?.key, "HuTao");
    assert.equal(doc.characters?.[0]?.talent.auto, 6);
    assert.equal(doc.weapons?.length, 1);
    assert.equal("materials" in doc, false);
  });

  it("emits Traveler{Element} keys and keeps the most advanced duplicate", () => {
    const roster = [
      {
        name: "Traveler",
        name_id: "PlayerBoy",
        element: "Pyro",
        isOwned: true,
        progress: {
          level: 60,
          ascension: 4,
          constellation: 1,
          talents: { normal: 6, skill: 6, burst: 6 },
          weapon: null,
        },
      },
      {
        name: "Traveler",
        name_id: "PlayerBoy-Pyro",
        element: "Pyro",
        isOwned: true,
        progress: {
          level: 90,
          ascension: 6,
          constellation: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          weapon: null,
        },
      },
    ] as CharacterOwned[];
    const doc = serializeGoodDocument({ roster });
    assert.deepEqual(
      doc.characters?.map((c) => [c.key, c.level, c.constellation]),
      [["TravelerPyro", 90, 6]],
    );
  });

  it("prefers equal level/constellation Traveler with higher talents", () => {
    const roster = [
      {
        name: "Traveler",
        name_id: "PlayerBoy",
        element: "Pyro",
        isOwned: true,
        progress: {
          level: 90,
          ascension: 6,
          constellation: 0,
          talents: { normal: 1, skill: 1, burst: 1 },
          weapon: null,
        },
      },
      {
        name: "Traveler",
        name_id: "PlayerBoy-Pyro",
        element: "Pyro",
        isOwned: true,
        progress: {
          level: 90,
          ascension: 6,
          constellation: 0,
          talents: { normal: 8, skill: 8, burst: 8 },
          weapon: null,
        },
      },
    ] as CharacterOwned[];
    const doc = serializeGoodDocument({ roster });
    assert.deepEqual(
      doc.characters?.map((c) => [
        c.key,
        c.talent.auto,
        c.talent.skill,
        c.talent.burst,
      ]),
      [["TravelerPyro", 8, 8, 8]],
    );
  });
});
