import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MANUAL_TCG_CARD_NAME_IDS,
  mergeTcgCardNameIds,
  parseTcgCardsFile,
  stemHasTcgCard,
} from "./tcg-cards.ts";

describe("mergeTcgCardNameIds", () => {
  it("always includes manual Traveler PlayerBoy", () => {
    const ids = mergeTcgCardNameIds(["Hutao", "Furina"]);
    assert.ok(ids.includes("PlayerBoy"));
    assert.ok(ids.includes("Hutao"));
    assert.deepEqual(MANUAL_TCG_CARD_NAME_IDS, ["PlayerBoy"]);
  });
});

describe("parseTcgCardsFile", () => {
  it("tolerates missing / malformed payloads", () => {
    assert.deepEqual(parseTcgCardsFile(null).name_ids, ["PlayerBoy"]);
    assert.deepEqual(parseTcgCardsFile({}).name_ids, ["PlayerBoy"]);
    assert.ok(
      parseTcgCardsFile({ name_ids: ["Amber", 1, ""] }).name_ids.includes(
        "Amber",
      ),
    );
  });
});

describe("stemHasTcgCard", () => {
  it("matches exact stems", () => {
    const set = new Set(mergeTcgCardNameIds(["Hutao"]));
    assert.equal(stemHasTcgCard(set, "Hutao"), true);
    assert.equal(stemHasTcgCard(set, "PlayerBoy"), true);
    assert.equal(stemHasTcgCard(set, "Amber"), false);
  });
});
