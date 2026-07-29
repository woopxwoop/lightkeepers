/**
 * Prometheus scrape endpoint.
 * Prometheus hits this every 15–60s on the compose network (prometheus.yml).
 *
 * Access requires Authorization: Bearer <METRICS_TOKEN>. Header presence
 * (e.g. CF-Connecting-IP) is never treated as authorization.
 */

import { timingSafeEqual } from "node:crypto";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { registry } from "$lib/server/metrics";

function bearerMatches(authHeader: string | null, token: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length);
  const expected = Buffer.from(token);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export const GET: RequestHandler = async ({ request }) => {
  const token = env.METRICS_TOKEN;
  if (!token) {
    throw error(404, "Not found");
  }

  if (!bearerMatches(request.headers.get("authorization"), token)) {
    throw error(401, "Unauthorized");
  }

  return new Response(await registry.metrics(), {
    headers: { "Content-Type": registry.contentType },
  });
};
