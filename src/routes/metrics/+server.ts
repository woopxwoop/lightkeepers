/**
 * Prometheus scrape endpoint.
 * Prometheus hits this every 15–60s on the compose network (prometheus.yml).
 *
 * Access requires Authorization: Bearer <METRICS_TOKEN>. Header presence
 * (e.g. CF-Connecting-IP) is never treated as authorization.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { registry } from "$lib/server/metrics";

/** Case-insensitive Bearer scheme; compares SHA-256 digests in constant time. */
function bearerMatches(authHeader: string | null, token: string): boolean {
  if (!authHeader) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return false;
  const provided = match[1]!;
  const expectedDigest = createHash("sha256").update(token).digest();
  const actualDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, actualDigest);
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
