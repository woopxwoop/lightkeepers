import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relicIconForSlot } from "./asset-urls.ts";

describe("relicIconForSlot", () => {
  it("maps set flower stem to each GOOD slot suffix", () => {
    const set = "UI_RelicIcon_15025_4";
    assert.equal(relicIconForSlot(set, "goblet"), "UI_RelicIcon_15025_1");
    assert.equal(relicIconForSlot(set, "plume"), "UI_RelicIcon_15025_2");
    assert.equal(relicIconForSlot(set, "circlet"), "UI_RelicIcon_15025_3");
    assert.equal(relicIconForSlot(set, "flower"), "UI_RelicIcon_15025_4");
    assert.equal(relicIconForSlot(set, "sands"), "UI_RelicIcon_15025_5");
  });

  it("returns null for non-relic stems", () => {
    assert.equal(relicIconForSlot("UI_EquipIcon_Sword_Test", "flower"), null);
    assert.equal(relicIconForSlot(null, "flower"), null);
  });
});
