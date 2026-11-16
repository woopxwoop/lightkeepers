/**
 * Cheap clears: a failed fetch stays retryable, and an empty 200 is not an error.
 *
 * Run: pnpm exec tsx --test src/lib/app/stygian-cheap-clears.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { CharacterOwned } from "../definitions.ts";
import {
  cheapClearsStatus,
  ensureCheapClears,
} from "./stygian-cheap-clears.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function owned(nameId: string): CharacterOwned[] {
  return [{ name_id: nameId, isOwned: true } as CharacterOwned];
}

describe("cheapClearsStatus", () => {
  const requestKey = "current";

  it("is idle when the mode is not asking", () => {
    assert.equal(
      cheapClearsStatus({
        active: false,
        bossCount: 3,
        fetch: "failed",
        fetchKey: requestKey,
        requestKey,
        rowCount: 0,
      }),
      "idle",
    );
  });

  it("is unavailable below three bosses and does not request", () => {
    assert.equal(
      cheapClearsStatus({
        active: true,
        bossCount: 2,
        fetch: "settled",
        fetchKey: requestKey,
        requestKey,
        rowCount: 4,
      }),
      "unavailable",
    );
  });

  it("is loading until the current request settles", () => {
    assert.equal(
      cheapClearsStatus({
        active: true,
        bossCount: 3,
        fetch: "idle",
        fetchKey: null,
        requestKey,
        rowCount: 0,
      }),
      "loading",
    );
    assert.equal(
      cheapClearsStatus({
        active: true,
        bossCount: 3,
        fetch: "failed",
        fetchKey: "previous",
        requestKey,
        rowCount: 0,
      }),
      "loading",
    );
  });

  it("separates a failed fetch from an empty payload and a real result", () => {
    assert.equal(
      cheapClearsStatus({
        active: true,
        bossCount: 3,
        fetch: "failed",
        fetchKey: requestKey,
        requestKey,
        rowCount: 0,
      }),
      "error",
    );
    assert.equal(
      cheapClearsStatus({
        active: true,
        bossCount: 3,
        fetch: "settled",
        fetchKey: requestKey,
        requestKey,
        rowCount: 0,
      }),
      "empty",
    );
    assert.equal(
      cheapClearsStatus({
        active: true,
        bossCount: 3,
        fetch: "settled",
        fetchKey: requestKey,
        requestKey,
        rowCount: 2,
      }),
      "ready",
    );
  });
});

describe("ensureCheapClears", () => {
  it("does not cache a failed fetch", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response("nope", { status: 500 });
      return Response.json({ rows: [{ team_key: "kept", enemy_id: 1 }] });
    };

    const opts = {
      owned: owned("RetryClear"),
      stygianVersion: 1,
      enemyIds: [1, 2, 3],
    };
    await assert.rejects(() => ensureCheapClears(opts));
    const rows = await ensureCheapClears(opts);
    await ensureCheapClears(opts);

    assert.equal(calls, 2);
    assert.equal(rows[0]?.team_key, "kept");
  });

  it("returns no rows for an empty 200", async () => {
    globalThis.fetch = async () => Response.json({ rows: [] });
    const rows = await ensureCheapClears({
      owned: owned("EmptyClear"),
      stygianVersion: 1,
      enemyIds: [4, 5, 6],
    });
    assert.deepEqual(rows, []);
  });
});
