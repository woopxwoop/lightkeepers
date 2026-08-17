import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { metricRouteLabel, shouldRecordHttpMetric } from "./metrics.ts";

describe("shouldRecordHttpMetric", () => {
  it("records app and API paths", () => {
    assert.equal(shouldRecordHttpMetric("/characters/nahida"), true);
    assert.equal(shouldRecordHttpMetric("/api/teams"), true);
  });

  it("skips self-scrape and hashed static assets", () => {
    assert.equal(shouldRecordHttpMetric("/metrics"), false);
    assert.equal(
      shouldRecordHttpMetric("/_app/immutable/chunks/abc.js"),
      false,
    );
    assert.equal(shouldRecordHttpMetric("/favicon.png"), false);
    assert.equal(shouldRecordHttpMetric("/favicon.ico"), false);
  });
});

describe("metricRouteLabel", () => {
  it("uses the SvelteKit route template", () => {
    assert.equal(metricRouteLabel("/characters/[slug]"), "/characters/[slug]");
    assert.equal(metricRouteLabel("/api/auth/[...all]"), "/api/auth/[...all]");
  });

  it("does not use the raw pathname for unmatched requests", () => {
    assert.equal(metricRouteLabel(null), "unmatched");
    assert.equal(metricRouteLabel(undefined), "unmatched");
    assert.equal(metricRouteLabel(""), "unmatched");
  });
});
