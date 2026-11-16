import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { error } from "@sveltejs/kit";
import { loadFromCdn } from "./cdn-proxy.ts";

const httpError = (status: number, message?: string) => (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === status &&
  (message === undefined ||
    ("body" in value &&
      (value.body as { message?: string }).message === message));

describe("loadFromCdn", () => {
  it("returns the loader's payload untouched", async () => {
    const payload = { rows: [1, 2] };
    const got = await loadFromCdn({
      route: "/api/x",
      what: "x data",
      load: async () => payload,
    });
    assert.equal(got, payload);
  });

  it("passes null through so the handler owns its 404", async () => {
    const got = await loadFromCdn({
      route: "/api/x",
      what: "x data",
      load: async () => null,
    });
    assert.equal(got, null);
  });

  it("turns loader failures into a generic 502 and logs the real error", async () => {
    const logged = mock.method(console, "error", () => {});
    try {
      await assert.rejects(
        loadFromCdn({
          route: "/api/x",
          what: "x data",
          load: async () => {
            throw new Error("CDN HTTP 503 at https://internal/secret-path");
          },
        }),
        httpError(502, "Failed to fetch x data from CDN"),
      );
      assert.equal(logged.mock.callCount(), 1);
      assert.equal(logged.mock.calls[0]!.arguments[0], "/api/x:");
    } finally {
      logged.mock.restore();
    }
  });

  it("lets deliberate HttpErrors through unchanged", async () => {
    await assert.rejects(
      loadFromCdn({
        route: "/api/x",
        what: "x data",
        load: async () => error(404, "No such thing"),
      }),
      httpError(404, "No such thing"),
    );
  });
});
