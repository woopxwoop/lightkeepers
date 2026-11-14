import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  artifactSetName,
  ensureEquipmentData,
  resolveArtifactSetKey,
  resolveWeaponKey,
  weaponName,
} from "./equipment-data.ts";
import { foldGoodKey } from "../utils.ts";

describe("foldGoodKey", () => {
  it("folds names, keys and odd casing to one comparison form", () => {
    for (const s of [
      "Wolf's Gravestone",
      "WolfsGravestone",
      "wolfs-gravestone",
    ]) {
      assert.equal(foldGoodKey(s), "wolfsgravestone", s);
    }
    assert.equal(foldGoodKey("!!"), "");
  });
});

describe("equipment lookups", () => {
  before(async () => {
    await ensureEquipmentData();
  });

  it("names weapons and sets by GOOD key; null when unknown", () => {
    assert.equal(weaponName("WolfsGravestone"), "Wolf's Gravestone");
    assert.equal(artifactSetName("GladiatorsFinale"), "Gladiator's Finale");
    assert.equal(weaponName("NotAWeapon"), null);
    assert.equal(artifactSetName("NotASet"), null);
  });

  it("resolves free text to GOOD keys: exact, case-insensitive, then folded", () => {
    for (const raw of [
      "WolfsGravestone",
      "wolfsgravestone",
      "Wolf's Gravestone",
    ]) {
      assert.equal(resolveWeaponKey(raw), "WolfsGravestone", raw);
    }
    assert.equal(
      resolveArtifactSetKey("Gladiator's Finale"),
      "GladiatorsFinale",
    );
    assert.equal(resolveWeaponKey("Definitely Not A Weapon"), null);
    assert.equal(resolveWeaponKey("!!"), null);
  });
});
