/**
 * Run: pnpm exec tsx --test src/lib/server/team-config.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readBoundedResponseBody } from "./team-config.ts";

const MAX = 512 * 1024;

function streamBody(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[i]!);
      i += 1;
    },
  });
}

describe("readBoundedResponseBody", () => {
  it("buffers a streamed response within the limit", async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const res = new Response(streamBody([payload.slice(0, 2), payload.slice(2)]));
    const buf = await readBoundedResponseBody(res, MAX);
    assert.ok(buf);
    assert.deepEqual([...buf!], [...payload]);
  });

  it("rejects Content-Length over the limit without reading the body", async () => {
    let cancelCalls = 0;
    const body = new ReadableStream<Uint8Array>({
      start() {
        /* unused — rejected via Content-Length before read */
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const res = new Response(body, {
      headers: { "content-length": String(MAX + 1) },
    });
    const buf = await readBoundedResponseBody(res, MAX);
    assert.equal(buf, null);
    assert.equal(cancelCalls, 1);
  });

  it("stops a streamed response once accumulated bytes exceed the limit", async () => {
    const chunk = new Uint8Array(256 * 1024);
    const res = new Response(streamBody([chunk, chunk, chunk]));
    const buf = await readBoundedResponseBody(res, MAX);
    assert.equal(buf, null);
  });
});
