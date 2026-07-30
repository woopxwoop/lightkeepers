import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPopTo, rememberNavigation } from "./nav-history.ts";

describe("nav-history", () => {
  it("only pops when the previous path matches the fallback", () => {
    rememberNavigation(new URL("https://example.test/teams?char=Furina"));
    assert.equal(canPopTo("/teams"), true);
    assert.equal(canPopTo("/teams?cost=4"), true);
    assert.equal(canPopTo("/characters"), false);

    rememberNavigation(null);
    assert.equal(canPopTo("/teams"), false);
  });
});
