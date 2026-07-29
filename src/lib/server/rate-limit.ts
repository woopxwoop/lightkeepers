/**
 * Shared API rate-limit enforcement.
 *
 * Wraps the getClientIp → checkApiRateLimit → 429 sequence so routes cannot
 * forget the trusted-proxy address or the fail-open behavior for requests
 * without a reliable client identity.
 */

import { error } from "@sveltejs/kit";
import { checkApiRateLimit, getClientIp } from "$lib/server/cache";

const RATE_LIMIT_MESSAGE = "Too many requests — please wait a moment.";

/** Throws 429 when the caller is over the shared 60/min/IP budget. */
export async function enforceApiRateLimit(event: {
  request: Request;
  getClientAddress?: () => string;
}): Promise<void> {
  const ip = getClientIp(event.request, event.getClientAddress);
  if (!(await checkApiRateLimit(ip))) {
    throw error(429, RATE_LIMIT_MESSAGE);
  }
}
