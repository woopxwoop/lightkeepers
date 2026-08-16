import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statIconUrl } from "./utils.ts";

describe("statIconUrl", () => {
  it("maps flat HP, ATK, and DEF to *_base.webp", () => {
    assert.equal(
      statIconUrl("hp"),
      "https://api.lightkeepers.moe/genshin/ui/hp_base.webp",
    );
    assert.equal(
      statIconUrl("atk"),
      "https://api.lightkeepers.moe/genshin/ui/atk_base.webp",
    );
    assert.equal(
      statIconUrl("def"),
      "https://api.lightkeepers.moe/genshin/ui/def_base.webp",
    );
  });

  it("maps percent HP, ATK, and DEF to bare stems", () => {
    assert.equal(
      statIconUrl("hp_"),
      "https://api.lightkeepers.moe/genshin/ui/hp.webp",
    );
    assert.equal(
      statIconUrl("atk_"),
      "https://api.lightkeepers.moe/genshin/ui/atk.webp",
    );
    assert.equal(
      statIconUrl("def_"),
      "https://api.lightkeepers.moe/genshin/ui/def.webp",
    );
  });
});
