/**
 * Cloud roster probe: HTTP failure is unreachable, null roster is empty.
 *
 * Run: pnpm exec tsx --test src/lib/app/cloud-roster-probe.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloudRosterProbeFromBody } from "./cloud-roster-probe.ts";

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

  it("treats a missing roster key as backed up", () => {
    assert.equal(
      cloudRosterProbeFromBody({ ok: true, roster: undefined }),
      "backed-up",
    );
  });
});
