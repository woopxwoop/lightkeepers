/**
 * Cloud roster probe: HTTP failure is unreachable, null roster is empty.
 *
 * Run: pnpm exec tsx --test src/lib/app/cloud-roster-probe.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  cloudRosterProbeFromBody,
  probeCloudRoster,
} from "./cloud-roster-probe.ts";

/** A stub fetch that answers `/api/roster` with this status + JSON body. */
const answering =
  (status: number, body: unknown): typeof fetch =>
  async (input) => {
    assert.equal(String(input), "/api/roster");
    return new Response(JSON.stringify(body), { status });
  };

describe("probeCloudRoster", () => {
  it("classifies a stored roster, an empty row, and a missing row", async () => {
    assert.equal(
      await probeCloudRoster(
        answering(200, { roster: [{ name_id: "hu_tao" }] }),
      ),
      "backed-up",
    );
    assert.equal(
      await probeCloudRoster(answering(200, { roster: [] })),
      "backed-up",
    );
    assert.equal(
      await probeCloudRoster(answering(200, { roster: null })),
      "empty",
    );
  });

  it("is unreachable (and logs) on a bad status, network error, or bad body", async () => {
    const logged = mock.method(console, "error", () => {});
    try {
      assert.equal(await probeCloudRoster(answering(500, {})), "unreachable");
      assert.equal(
        await probeCloudRoster(async () => {
          throw new TypeError("Failed to fetch");
        }),
        "unreachable",
      );
      assert.equal(
        await probeCloudRoster(
          async () => new Response("not json", { status: 200 }),
        ),
        "unreachable",
      );
      assert.equal(await probeCloudRoster(answering(200, null)), "unreachable");
      assert.equal(logged.mock.callCount(), 3);
    } finally {
      logged.mock.restore();
    }
  });
});

describe("cloudRosterProbeFromBody", () => {
  it("is unreachable when the roster read fails", () => {
    assert.equal(
      cloudRosterProbeFromBody({ ok: false, roster: [{ name_id: "hu_tao" }] }),
      "unreachable",
    );
  });

  it("is empty only when the cloud row is null", () => {
    assert.equal(cloudRosterProbeFromBody({ ok: true, roster: null }), "empty");
  });

  it("is backed up for a stored list, including an empty one", () => {
    assert.equal(
      cloudRosterProbeFromBody({ ok: true, roster: [] }),
      "backed-up",
    );
    assert.equal(
      cloudRosterProbeFromBody({
        ok: true,
        roster: [{ name_id: "hu_tao" }],
      }),
      "backed-up",
    );
  });

  it("is unreachable when the roster key is omitted or not a list", () => {
    assert.equal(
      cloudRosterProbeFromBody({ ok: true, roster: undefined }),
      "unreachable",
    );
    assert.equal(
      cloudRosterProbeFromBody({ ok: true, roster: { name_id: "hu_tao" } }),
      "unreachable",
    );
  });
});
