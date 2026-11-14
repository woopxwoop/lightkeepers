import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withDeadline } from "./cdn-fetch.ts";

/** A fetch that never settles unless its signal aborts — a stalled upstream. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });

describe("withDeadline", () => {
  it("passes a timely response through untouched", async () => {
    const ok = new Response("ok", { status: 200 });
    const fetchFn = withDeadline(async () => ok, 1_000);
    assert.equal(await fetchFn("https://example.test"), ok);
  });

  it("aborts a stalled request with a final AbortError naming the deadline", async () => {
    const fetchFn = withDeadline(hangingFetch, 30);
    const started = Date.now();
    await assert.rejects(fetchFn("https://example.test"), {
      name: "AbortError",
      message: /30 ms deadline/,
    });
    assert.ok(Date.now() - started < 1_000, "settles near the deadline");
  });

  it("still honours the caller's own abort signal", async () => {
    const fetchFn = withDeadline(hangingFetch, 10_000);
    const controller = new AbortController();
    const pending = fetchFn("https://example.test", {
      signal: controller.signal,
    });
    controller.abort(new Error("caller cancelled"));
    await assert.rejects(pending, /caller cancelled/);
  });

  it("keeps the caller's other init options", async () => {
    let seen: RequestInit | undefined;
    const fetchFn = withDeadline(async (_input, init) => {
      seen = init;
      return new Response(null, { status: 204 });
    }, 1_000);
    await fetchFn("https://example.test", {
      method: "POST",
      headers: { "x-test": "1" },
    });
    assert.equal(seen?.method, "POST");
    assert.deepEqual(seen?.headers, { "x-test": "1" });
    assert.ok(seen?.signal instanceof AbortSignal);
  });
});
