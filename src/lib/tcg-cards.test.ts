import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MANUAL_TCG_CARD_NAME_IDS,
  mergeTcgCardNameIds,
  parseTcgCardsFile,
  stemHasTcgCard,
  tcgCardsPayloadFromCdn,
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

describe("tcgCardsPayloadFromCdn", () => {
  it("keeps a published name_ids array as a settled manifest", () => {
    const payload = tcgCardsPayloadFromCdn({ name_ids: ["Hutao"] });
    assert.equal("provisional" in payload, false);
    assert.ok(payload.name_ids.includes("Hutao"));
    assert.ok(payload.name_ids.includes("PlayerBoy"));
  });

  it("marks a missing or non-array manifest provisional", () => {
    for (const raw of [null, {}, { name_ids: "Hutao" }, { name_ids: null }]) {
      const payload = tcgCardsPayloadFromCdn(raw);
      assert.equal(payload.provisional, true);
      assert.deepEqual(payload.name_ids, ["PlayerBoy"]);
    }
  });

  it("treats an empty name_ids array as published", () => {
    const payload = tcgCardsPayloadFromCdn({ name_ids: [] });
    assert.equal("provisional" in payload, false);
    assert.deepEqual(payload.name_ids, ["PlayerBoy"]);
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
