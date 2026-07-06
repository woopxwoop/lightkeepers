/**
 * src/hooks.server.ts
 */

import { sequence } from "@sveltejs/kit/hooks";
import { handleErrorWithSentry, sentryHandle } from "@sentry/sveltekit";
import { metrics } from "$lib/server/metrics";
import { auth } from "$lib/server/auth";
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

const SKIP_AUTH_PREFIXES = ["/_app/", "/favicon"];
const SKIP_AUTH_PATHS = new Set(["/metrics"]);

const authHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (
    SKIP_AUTH_PATHS.has(pathname) ||
    SKIP_AUTH_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  try {
    const session = await auth.api.getSession({ headers: event.request.headers });
    event.locals.user = session?.user ?? null;
    event.locals.session = session?.session ?? null;
  } catch (err) {
    console.error("authHandle: getSession failed", err);
    event.locals.user = null;
    event.locals.session = null;
  }

  const response = await resolve(event);

  // Cache anonymous HTML pages at the CDN edge.
  // Cloudflare respects s-maxage for HTML when no session cookie is present.
  // Logged-in users get uncached responses (private, no-cache below).
  //
  // Only check for the Better Auth session cookie — anonymous users with
  // unrelated cookies (analytics, consent banners) should still get edge caching.
  if (
    !event.locals.user &&
    event.request.method === "GET" &&
    response.headers.get("content-type")?.startsWith("text/html") &&
    !event.request.headers.get("cookie")?.includes("better-auth.session_token") &&
    !response.headers.has("set-cookie") &&
    !response.headers.has("cache-control")
  ) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60",
    );
  }

  return response;
};

export const handle = sequence(sentryHandle(), authHandle, metricsHandle);
export const handleError = handleErrorWithSentry();
