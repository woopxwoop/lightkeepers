/**
 * Prometheus scrape endpoint.
 * Prometheus hits this every 15s on the compose network (prometheus.yml).
 *
 * Requests that arrive via Cloudflare Tunnel carry CF-Connecting-IP — reject
 * those so /metrics is not public. Internal scrapes have no that header.
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { registry } from "$lib/server/metrics";

export const GET: RequestHandler = async ({ request }) => {
  if (request.headers.get("cf-connecting-ip")) {
    throw error(404, "Not found");
  }

  return new Response(await registry.metrics(), {
    headers: { "Content-Type": registry.contentType },
  });
};
