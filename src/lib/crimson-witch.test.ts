/**
 * Unit tests for Crimson Witch character URL helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCrimsonWitchLinks,
  getCrimsonWitchUrl,
  toCrimsonWitchSlug,
  TRAVELER_GUIDE_ELEMENTS,
} from "./utils.ts";

describe("toCrimsonWitchSlug", () => {
  it("joins multi-word names with underscores", () => {
    assert.equal(toCrimsonWitchSlug("Hu Tao"), "Hu_Tao");
    assert.equal(toCrimsonWitchSlug("Raiden Shogun"), "Raiden_Shogun");
    assert.equal(toCrimsonWitchSlug("Odette"), "Odette");
  });

  it("uses Element_Traveler for traveler variants", () => {
    assert.equal(
      toCrimsonWitchSlug("Traveler", { isTraveler: true, element: "Cryo" }),
      "Cryo_Traveler",
    );
    assert.equal(
      toCrimsonWitchSlug("Traveler", { isTraveler: true, element: "Pyro" }),
      "Pyro_Traveler",
    );
  });

  it("falls back to Traveler when element is missing", () => {
    assert.equal(
      toCrimsonWitchSlug("Traveler", { isTraveler: true, element: null }),
      "Traveler",
    );
  });
});

describe("getCrimsonWitchUrl", () => {
  it("builds absolute guide URLs", () => {
    assert.equal(
      getCrimsonWitchUrl("Odette"),
      "https://www.crimsonwitch.com/Odette",
    );
    assert.equal(
      getCrimsonWitchUrl("Traveler", {
        isTraveler: true,
        element: "Cryo",
      }),
      "https://www.crimsonwitch.com/Cryo_Traveler",
    );
  });
});

describe("getCrimsonWitchLinks", () => {
  it("returns one link for normal characters", () => {
    assert.deepEqual(getCrimsonWitchLinks("Hu Tao"), [
      { label: "Hu Tao", url: "https://www.crimsonwitch.com/Hu_Tao" },
    ]);
  });

  it("expands traveler to every resonance guide", () => {
    const links = getCrimsonWitchLinks("Traveler", {
      isTraveler: true,
      element: null,
    });
    assert.equal(links.length, TRAVELER_GUIDE_ELEMENTS.length);
    assert.deepEqual(
      links.map((l) => l.element),
      [...TRAVELER_GUIDE_ELEMENTS],
    );
    assert.equal(links[0]?.url, "https://www.crimsonwitch.com/Anemo_Traveler");
    assert.equal(
      links.at(-1)?.url,
      "https://www.crimsonwitch.com/Cryo_Traveler",
    );
  });

  // The character route hides its Useful links list on an empty array.
  it("returns no links for a blank name", () => {
    assert.deepEqual(getCrimsonWitchLinks("   "), []);
  });
});
