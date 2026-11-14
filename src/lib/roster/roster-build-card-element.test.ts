import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enkaElementAccent,
  enkaElementClass,
} from "./roster-build-card-element.ts";

describe("enkaElementClass", () => {
  it("maps game elements to Enka class names", () => {
    assert.equal(enkaElementClass("Pyro"), "Fire");
    assert.equal(enkaElementClass("Hydro"), "Water");
    assert.equal(enkaElementClass("Anemo"), "Wind");
    assert.equal(enkaElementClass("Electro"), "Electric");
    assert.equal(enkaElementClass("Dendro"), "Grass");
    assert.equal(enkaElementClass("Geo"), "Rock");
    assert.equal(enkaElementClass("Cryo"), "Ice");
  });

  it("falls back to Fire", () => {
    assert.equal(enkaElementClass(null), "Fire");
    assert.equal(enkaElementClass(undefined), "Fire");
    assert.equal(enkaElementClass("Physical"), "Fire");
  });
});

describe("enkaElementAccent", () => {
  it("returns the element gradient, Fire's for unknown classes", () => {
    assert.equal(
      enkaElementAccent("Ice"),
      "linear-gradient(0deg, #154f68 0%, #08394f 100%)",
    );
    assert.equal(enkaElementAccent("Nope"), enkaElementAccent("Fire"));
    assert.equal(
      enkaElementAccent("Fire"),
      "linear-gradient(0deg, #68281b 0%, #4f180d 100%)",
    );
  });
});
