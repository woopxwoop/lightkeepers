/**
 * Prometheus scrape endpoint.
 * Prometheus hits this every 15–60s on the compose network (prometheus.yml).
 *
 * Access requires Authorization: Bearer <METRICS_TOKEN>. Header presence
 * (e.g. CF-Connecting-IP) is never treated as authorization.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { registry } from "$lib/server/metrics";

export const GET: RequestHandler = async ({ request }) => {
  const token = env.METRICS_TOKEN;
  if (!token) {
    throw error(404, "Not found");
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    throw error(401, "Unauthorized");
  }

  return new Response(await registry.metrics(), {
    headers: { "Content-Type": registry.contentType },
  });
};
