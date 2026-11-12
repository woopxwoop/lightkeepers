/**
 * Owned-team fetches must follow the roster.
 *
 * An empty character list is the all-teams sentinel on the server. A fetch
 * started before the roster is seeded, or joined across two different
 * rosters, must not stick as the owned-team list.
 *
 * Run: pnpm exec tsx --test src/lib/stores.teams-owned.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { get } from "svelte/store";
import type { CharacterOwned } from "./definitions.ts";
import {
  charactersOwned,
  ensureNearMissTeams,
  ensureStaticBoards,
  ensureTeamsOwned,
  invalidateNearMissTeams,
  invalidateTeamsOwned,
  nearMissStatus,
  resetStaticBoards,
  setVersionNumbers,
  teamsOwned,
  teamsOwnedStatus,
} from "./stores.ts";

function row(name_id: string, isOwned: boolean): CharacterOwned {
  return { name_id, isOwned } as CharacterOwned;
}

const realFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

beforeEach(() => {
  invalidateTeamsOwned();
  setVersionNumbers(6, 3);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  invalidateTeamsOwned();
});

describe("ensureTeamsOwned", () => {
  it("does not post an empty roster", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return jsonResponse({
        abyssTeams: [{ team_key: "all" }],
        stygianTeams: [],
      });
    };

    await ensureTeamsOwned([row("Furina", false)]);

    assert.equal(calls, 0);
    assert.equal(get(teamsOwnedStatus), "ready");
    assert.deepEqual(get(teamsOwned), []);
  });

  it("refetches when the seeded roster replaces the empty pre-seed list", async () => {
    const bodies: string[][] = [];
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { characters: string[] };
      bodies.push(body.characters);
      return jsonResponse({
        abyssTeams: [{ team_key: body.characters.join(",") }],
        stygianTeams: [],
      });
    };

    await ensureTeamsOwned([]);
    await ensureTeamsOwned([row("Furina", true), row("Xingqiu", false)]);

    assert.deepEqual(bodies, [["Furina"]]);
    assert.equal(get(teamsOwned)[0]?.team_key, "Furina");
  });

  it("drops a superseded roster when a later one resolves first", async () => {
    let releaseFirst: () => void = () => {};
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { characters: string[] };
      if (body.characters.includes("only-a")) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return jsonResponse({
        abyssTeams: [
          { team_key: body.characters[0], members: body.characters },
        ],
        stygianTeams: [],
      });
    };

    const first = ensureTeamsOwned([
      row("only-a", true),
      row("not-owned", false),
    ]);
    const second = ensureTeamsOwned([row("only-b", true)]);
    releaseFirst();
    await Promise.all([first, second]);

    assert.equal(get(teamsOwned)[0]?.team_key, "only-b");
    assert.deepEqual((get(teamsOwned)[0] as { members?: string[] }).members, [
      "only-b",
    ]);
  });

  it("retries a roster after the fetch fails", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response("nope", { status: 500 });
      return jsonResponse({
        abyssTeams: [{ team_key: "ok" }],
        stygianTeams: [],
      });
    };

    await assert.rejects(() => ensureTeamsOwned([row("Furina", true)]));
    assert.equal(get(teamsOwnedStatus), "error");
    assert.deepEqual(get(teamsOwned), []);

    await ensureTeamsOwned([row("Furina", true)]);
    assert.equal(calls, 2);
    assert.equal(get(teamsOwnedStatus), "ready");
    assert.equal(get(teamsOwned)[0]?.team_key, "ok");
  });

  it("refetches when either board version changes", async () => {
    const versions: number[] = [];
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { abyssVersion: number };
      versions.push(body.abyssVersion);
      return jsonResponse({
        abyssTeams: [{ team_key: String(body.abyssVersion) }],
        stygianTeams: [],
      });
    };

    await ensureTeamsOwned([row("Furina", true)]);
    await ensureTeamsOwned([row("Furina", true)]);
    assert.deepEqual(versions, [6]);

    setVersionNumbers(7, 4);
    await ensureTeamsOwned([row("Furina", true)]);
    assert.deepEqual(versions, [6, 7]);
    assert.equal(get(teamsOwned)[0]?.team_key, "7");
  });
});

describe("ensureNearMissTeams", () => {
  beforeEach(() => {
    invalidateNearMissTeams();
  });

  it("keeps a failed fetch retryable", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response("nope", { status: 500 });
      return jsonResponse({ nearMissTeams: [], nearMissPairs: [] });
    };

    await assert.rejects(() => ensureNearMissTeams([row("Furina", true)]));
    assert.equal(get(nearMissStatus), "error");

    await ensureNearMissTeams([row("Furina", true)]);
    assert.equal(calls, 2);
    assert.equal(get(nearMissStatus), "ready");
  });

  it("refetches after the stygian version changes", async () => {
    const versions: number[] = [];
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        stygianVersion: number;
      };
      versions.push(body.stygianVersion);
      return jsonResponse({ nearMissTeams: [], nearMissPairs: [] });
    };

    await ensureNearMissTeams([row("Furina", true)]);
    assert.equal(get(nearMissStatus), "ready");
    setVersionNumbers(6, 4);
    assert.equal(get(nearMissStatus), "idle");
    await ensureNearMissTeams([row("Furina", true)]);
    assert.deepEqual(versions, [3, 4]);
  });

  it("drops ready lists when the roster store changes", async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        abyssTeams: [],
        stygianTeams: [],
        nearMissTeams: [],
        nearMissPairs: [],
      });
    charactersOwned.set([row("Furina", true)]);
    await ensureTeamsOwned([row("Furina", true)]);
    await ensureNearMissTeams([row("Furina", true)]);
    assert.equal(get(teamsOwnedStatus), "ready");
    assert.equal(get(nearMissStatus), "ready");

    charactersOwned.set([row("Furina", true), row("Xingqiu", true)]);
    assert.equal(get(teamsOwnedStatus), "idle");
    assert.equal(get(nearMissStatus), "idle");
    charactersOwned.set([]);
  });
});

describe("owned team requests while boards are stale", () => {
  beforeEach(() => {
    resetStaticBoards();
    invalidateTeamsOwned();
    setVersionNumbers(6, 3);
  });

  afterEach(() => {
    resetStaticBoards();
    invalidateTeamsOwned();
  });

  it("posts the retained board version instead of the newer layout version", async () => {
    const posted: number[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/api/teams")) {
        const body = JSON.parse(String(init?.body)) as { abyssVersion: number };
        posted.push(body.abyssVersion);
        return jsonResponse({ abyssTeams: [], stygianTeams: [] });
      }
      return jsonResponse({
        allTeamsAbyss: [{ team_key: "abyss-6" }],
        allTeamsStygian: [{ team_key: "stygian-3" }],
        latestAbyssVersion: { version_number: 6 },
        latestStygianVersion: { version_number: 3 },
      });
    };

    setVersionNumbers(7, 4);
    await ensureStaticBoards();
    await ensureTeamsOwned([row("Furina", true)]);

    assert.deepEqual(posted, [6]);
  });
});
