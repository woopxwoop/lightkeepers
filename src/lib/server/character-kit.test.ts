import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { getCharacterKitResult } from "./character-kit.ts";

const MIN = 60 * 1000;

type Reply = { status: number; body?: unknown } | "network-error";

/** Stub global fetch: answers by URL substring, counts calls per name id. */
function stubFetch(reply: (url: string) => Reply) {
  const calls: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const r = reply(url);
    if (r === "network-error") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  });
  return calls;
}

const kit = (name: string) => ({ name_id: name, name });

describe("getCharacterKitResult", () => {
  beforeEach(() => {
    mock.timers.enable({
      apis: ["Date"],
      now: Date.parse("2026-11-13T00:00:00Z"),
    });
  });
  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it("caches a live kit (one fetch for repeated reads)", async () => {
    const calls = stubFetch(() => ({ status: 200, body: kit("KitA") }));
    const a = await getCharacterKitResult("KitA");
    const b = await getCharacterKitResult("KitA");
    assert.equal(a?.kit.name_id, "KitA");
    assert.equal(a?.channel, "live");
    assert.equal(b, a);
    assert.equal(calls.length, 1);
  });

  it("falls back to beta, and caches a definitive miss as null", async () => {
    stubFetch((url) =>
      url.includes("/beta/") && url.includes("KitBeta")
        ? { status: 200, body: kit("KitBeta") }
        : { status: 404 },
    );
    assert.equal((await getCharacterKitResult("KitBeta"))?.channel, "beta");
    const calls = stubFetch(() => ({ status: 404 }));
    assert.equal(await getCharacterKitResult("NoSuchKit"), null);
    assert.equal(await getCharacterKitResult("NoSuchKit"), null);
    assert.equal(calls.length, 2, "live + beta once, then cached");
  });

  it("throws on a CDN outage with nothing cached, and retries next time", async () => {
    let fail = true;
    const calls = stubFetch(() =>
      fail ? { status: 503 } : { status: 200, body: kit("KitOutage") },
    );
    await assert.rejects(getCharacterKitResult("KitOutage"), /HTTP 503/);
    fail = false;
    assert.equal(
      (await getCharacterKitResult("KitOutage"))?.kit.name_id,
      "KitOutage",
    );
    assert.equal(calls.length, 2);
  });

  it("serves the stale kit when the CDN fails after the TTL", async () => {
    let down = false;
    stubFetch(() =>
      down ? "network-error" : { status: 200, body: kit("KitStale") },
    );
    const fresh = await getCharacterKitResult("KitStale");

    down = true;
    mock.timers.tick(16 * MIN); // past the 15 min TTL, well within a day
    const stale = await getCharacterKitResult("KitStale");
    assert.equal(stale, fresh, "stale copy returned instead of throwing");
  });

  it("refetches a cached miss after the TTL instead of serving it stale", async () => {
    let released = false;
    stubFetch(() =>
      released ? { status: 200, body: kit("KitLate") } : { status: 404 },
    );
    assert.equal(await getCharacterKitResult("KitLate"), null);

    released = true;
    mock.timers.tick(16 * MIN);
    const late = await getCharacterKitResult("KitLate");
    assert.equal(late?.kit.name_id, "KitLate");
    assert.equal(late?.channel, "live");
  });
});
