/**
 * GET /api/health
 *
 * Used by Better Stack as the uptime monitor endpoint.
 * Returns 200 + JSON when healthy, 503 when Supabase is unreachable.
 *
 * Cache: no-store so Better Stack always hits the live app.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import { metrics } from "$lib/server/metrics";

export const GET: RequestHandler = async () => {
  const start = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  try {
    const { error } = await serverDb
      .from("abyss_versions")
      .select("version_number")
      .limit(1)
      .maybeSingle();

    checks.supabase = error ? "error" : "ok";
  } catch {
    checks.supabase = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  const durationMs = Date.now() - start;

  metrics.log("info", "health_check", {
    healthy: String(healthy),
    duration_ms: String(durationMs),
    ...checks,
  });

  return json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      durationMs,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
};
