/**
 * A complete board is `board`. A partial one is hidden (`none`).
 *
 * Run: pnpm exec tsx --test src/lib/board-solutions.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardOutcome } from "./board-solutions.ts";

describe("boardOutcome", () => {
  it("keeps a complete board, including a filled fallback", () => {
    assert.equal(boardOutcome([{ unfilled: [] }]), "board");
    assert.equal(
      boardOutcome([{ unfilled: ["top"] }, { unfilled: [] }]),
      "board",
    );
  });

  it("is none when every board is missing a slot", () => {
    assert.equal(boardOutcome([]), "none");
    assert.equal(boardOutcome([{ unfilled: ["middle"] }]), "none");
  });
});
