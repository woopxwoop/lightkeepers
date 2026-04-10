/**
 * src/hooks.server.ts
 */

import { sequence } from "@sveltejs/kit/hooks";
import { handleErrorWithSentry, sentryHandle } from "@sentry/sveltekit";
import { metrics } from "$lib/server/metrics";
import type { Handle } from "@sveltejs/kit";

const metricsHandle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const response = await resolve(event);

  // Skip recording the /metrics endpoint itself to avoid self-referential noise
  if (event.url.pathname !== "/metrics") {
    metrics.recordRequest({
      path: event.url.pathname,
      method: event.request.method,
      status: response.status,
      durationMs: Date.now() - start,
    });
  }

  return response;
};

export const handle = sequence(sentryHandle(), metricsHandle);
export const handleError = handleErrorWithSentry();
