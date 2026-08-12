import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBetaCharacter } from "./is-beta-character.ts";

describe("isBetaCharacter", () => {
  it("flags CB chars with no release date", () => {
    assert.equal(isBetaCharacter("Alyosha", null), true);
    assert.equal(isBetaCharacter("Odette", ""), true);
  });

  it("skips travelers and released rows", () => {
    assert.equal(isBetaCharacter("PlayerBoy", null), false);
    assert.equal(isBetaCharacter("PlayerGirl-Anemo", null), false);
    assert.equal(isBetaCharacter("", null), false);
    assert.equal(isBetaCharacter("Hutao", "2020-03-17T00:00:00+00"), false);
  });
});
