/**
 * Static boards publish one phase. A stale cycle stays visible, and a
 * failed refetch does not pretend the previous teams were never loaded.
 *
 * Run: pnpm exec tsx --test src/lib/stores.static-boards.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { get } from "svelte/store";
import {
  allTeamsAbyss,
  ensureStaticBoards,
  resetStaticBoards,
  setVersionNumbers,
  staticBoardsPhase,
  staticBoardsView,
  type StaticBoardsPhase,
} from "./stores.ts";

function payload(abyss: number, stygian: number) {
  return {
    allTeamsAbyss: [{ team_key: `abyss-${abyss}` }],
    allTeamsStygian: [{ team_key: `stygian-${stygian}` }],
    latestAbyssVersion: { version_number: abyss },
    latestStygianVersion: { version_number: stygian },
  };
}

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  resetStaticBoards();
  setVersionNumbers(6, 3);
});

afterEach(() => {
  resetStaticBoards();
  globalThis.fetch = realFetch;
});

describe("staticBoardsView", () => {
  it("maps each phase to one screen", () => {
    const cases: [StaticBoardsPhase, string][] = [
      [{ phase: "cold" }, "loading"],
      [{ phase: "loading" }, "loading"],
      [{ phase: "current" }, "board"],
      [{ phase: "stale" }, "stale"],
      [{ phase: "error", retained: false }, "empty-error"],
      [{ phase: "error", retained: true }, "retry"],
    ];
    for (const [phase, expect] of cases) {
      const view = staticBoardsView(phase);
      if (expect === "loading" || expect === "empty-error") {
        assert.equal(view.kind, expect);
      } else if (expect === "board") {
        assert.deepEqual(view, { kind: "board", notice: null });
      } else {
        assert.deepEqual(view, { kind: "board", notice: expect });
      }
    }
  });
});

describe("ensureStaticBoards", () => {
  it("stores a payload that matches the layout versions as current", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return jsonResponse(payload(6, 3));
    };

    await ensureStaticBoards();
    await ensureStaticBoards();

    assert.equal(calls, 1);
    assert.equal(get(staticBoardsPhase).phase, "current");
    assert.equal(get(allTeamsAbyss)[0]?.team_key, "abyss-6");
  });

  it("keeps a behind payload and tells the screen it is the previous cycle", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return jsonResponse(payload(5, 2));
    };

    await ensureStaticBoards();

    assert.equal(calls, 2);
    assert.equal(get(staticBoardsPhase).phase, "stale");
    assert.equal(get(allTeamsAbyss)[0]?.team_key, "abyss-5");
    assert.deepEqual(staticBoardsView(get(staticBoardsPhase)), {
      kind: "board",
      notice: "stale",
    });

    await ensureStaticBoards();
    assert.equal(calls, 2);

    await ensureStaticBoards({ force: true });
    assert.equal(calls, 4);
  });

  it("is an empty error when the first fetch fails", async () => {
    globalThis.fetch = async () => new Response("nope", { status: 500 });

    await assert.rejects(() => ensureStaticBoards());

    assert.deepEqual(get(staticBoardsPhase), {
      phase: "error",
      retained: false,
    });
    assert.equal(staticBoardsView(get(staticBoardsPhase)).kind, "empty-error");
  });

  it("keeps teams when a later fetch fails", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(payload(6, 3));
      return new Response("nope", { status: 500 });
    };

    await ensureStaticBoards();
    setVersionNumbers(7, 3);
    await assert.rejects(() => ensureStaticBoards());

    assert.deepEqual(get(staticBoardsPhase), {
      phase: "error",
      retained: true,
    });
    assert.equal(get(allTeamsAbyss)[0]?.team_key, "abyss-6");
    assert.deepEqual(staticBoardsView(get(staticBoardsPhase)), {
      kind: "board",
      notice: "retry",
    });
  });
});
