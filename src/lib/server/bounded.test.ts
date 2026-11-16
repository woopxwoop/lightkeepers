import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withinOr } from "./bounded.ts";

const never = <T>() => new Promise<T>(() => {});

describe("withinOr", () => {
  it("returns the operation's value when it settles in time", async () => {
    assert.equal(await withinOr(Promise.resolve(42), 1_000, null), 42);
  });

  it("falls back and reports when the operation stalls", async () => {
    let timedOut = 0;
    const started = Date.now();
    const result = await withinOr(never<number>(), 30, "miss", () => {
      timedOut++;
    });
    assert.equal(result, "miss");
    assert.equal(timedOut, 1);
    assert.ok(Date.now() - started < 1_000, "settles near the deadline");
  });

  it("propagates a rejection that happens before the deadline", async () => {
    await assert.rejects(
      withinOr(Promise.reject(new Error("boom")), 1_000, null),
      /boom/,
    );
  });

  it("ignores a rejection that arrives after the fallback", async () => {
    let fail!: (err: Error) => void;
    const late = new Promise<number>((_, reject) => (fail = reject));
    assert.equal(await withinOr(late, 20, "miss"), "miss");
    fail(new Error("late")); // must not surface as an unhandled rejection
    await new Promise((r) => setTimeout(r, 20));
  });
});
