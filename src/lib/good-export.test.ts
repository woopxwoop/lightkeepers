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
});
