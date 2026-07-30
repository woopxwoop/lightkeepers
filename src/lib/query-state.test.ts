/**
 * Unit tests for URL filter-state helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSearchPath, readEnum, readList } from "./query-state.ts";

function url(search: string): URL {
  return new URL(`https://example.test/teams${search}`);
}

describe("readList", () => {
  it("collects repeated values", () => {
    assert.deepEqual(readList(url("?char=Furina&char=Skirk"), "char"), [
      "Furina",
      "Skirk",
    ]);
  });

  it("drops values outside the allowed set", () => {
    assert.deepEqual(
      readList(url("?rarity=5&rarity=3"), "rarity", ["4", "5"]),
      ["5"],
    );
  });
});

describe("readEnum", () => {
  const keys = ["dps-desc", "dps-asc"] as const;

  it("accepts a known value", () => {
    assert.equal(readEnum(url("?sort=dps-asc"), "sort", keys, "dps-desc"), "dps-asc");
  });

  it("falls back on junk or missing values", () => {
    assert.equal(readEnum(url("?sort=nope"), "sort", keys, "dps-desc"), "dps-desc");
    assert.equal(readEnum(url(""), "sort", keys, "dps-desc"), "dps-desc");
  });
});

describe("nextSearchPath", () => {
  it("returns null when the URL already matches", () => {
    const current = url("?char=Furina&sort=dps-asc");
    assert.equal(
      nextSearchPath(current, { char: ["Furina"], sort: "dps-asc" }),
      null,
    );
  });

  it("ignores param order when comparing", () => {
    const current = url("?sort=dps-asc&char=Furina");
    assert.equal(
      nextSearchPath(current, { char: ["Furina"], sort: "dps-asc" }),
      null,
    );
  });

  it("drops keys for empty values", () => {
    assert.equal(
      nextSearchPath(url("?char=Furina&sort=dps-asc"), {
        char: [],
        sort: null,
      }),
      "/teams",
    );
  });

  it("writes repeated values and preserves unrelated params", () => {
    assert.equal(
      nextSearchPath(url("?ref=discord"), { char: ["Furina", "Skirk"] }),
      "/teams?ref=discord&char=Furina&char=Skirk",
    );
  });

  it("is stable — applying its own result yields null", () => {
    const patch = { char: ["Furina"], cost: "4" };
    const next = nextSearchPath(url(""), patch);
    assert.equal(next, "/teams?char=Furina&cost=4");
    assert.equal(nextSearchPath(url("?char=Furina&cost=4"), patch), null);
  });
});
