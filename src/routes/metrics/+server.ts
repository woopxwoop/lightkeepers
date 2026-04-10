/**
 * src/routes/metrics/+server.ts
 *
 * Prometheus scrape endpoint.
 * Prometheus hits this every 15s (configured in prometheus.yml).
 *
 * Restrict access to localhost/internal network via your reverse proxy
 * (nginx/Caddy) — don't expose this publicly.
 */

import type { RequestHandler } from "./$types";
import { registry } from "$lib/server/metrics";

export const GET: RequestHandler = async () => {
  return new Response(await registry.metrics(), {
    headers: { "Content-Type": registry.contentType },
  });
};
