/**
 * src/lib/server/metrics.ts
 *
 * Exposes Prometheus metrics via prom-client.
 * Scraped by Prometheus at /metrics — no push, no OTLP gateway.
 *
 * Usage:
 *   import { metrics } from '$lib/server/metrics';
 *   metrics.recordRequest({ path, method, status, durationMs });
 *   metrics.log('info', 'something happened', { key: 'value' });
 *
 * HTTP `path` labels must be bounded route templates (`event.route.id`),
 * never raw URLs — slugs and 404 scans explode Grafana Cloud series.
 */

import client from "prom-client";

const SERVICE = "lightkeepers";
const SLOW_REQUEST_MS = 2_000;
const UNMATCHED_ROUTE = "unmatched";

// ── Registry ───────────────────────────────────────────────────────────────
// Use a custom registry so we don't accidentally share state with other libs.

export const registry = new client.Registry();
registry.setDefaultLabels({ service: SERVICE });

// Collect default Node.js metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register: registry });

// ── Custom metrics ─────────────────────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status", "status_class"],
  registers: [registry],
});

const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "path"],
  // Buckets tuned for a web app: fast API responses up to slow DB queries
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

/** Skip self-scrape and hashed/static assets — those paths are unbounded. */
export function shouldRecordHttpMetric(pathname: string): boolean {
  return (
    pathname !== "/metrics" &&
    !pathname.startsWith("/_app/") &&
    !pathname.startsWith("/favicon")
  );
}

/**
 * Bounded Prometheus path label: SvelteKit route id, or a single unmatched bucket.
 * Never fall back to the request pathname.
 */
export function metricRouteLabel(routeId: string | null | undefined): string {
  return routeId || UNMATCHED_ROUTE;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type RequestRecord = {
  path: string;
  method: string;
  status: number;
  durationMs: number;
};

type LogLevel = "info" | "warn" | "error";

// ── Public API ─────────────────────────────────────────────────────────────

export const metrics = {
  recordRequest(rec: RequestRecord): void {
    const statusClass = `${Math.floor(rec.status / 100)}xx`;

    httpRequestsTotal.inc({
      method: rec.method,
      path: rec.path,
      status: String(rec.status),
      status_class: statusClass,
    });

    httpRequestDurationMs.observe(
      { method: rec.method, path: rec.path },
      rec.durationMs,
    );

    if (rec.durationMs >= SLOW_REQUEST_MS) {
      metrics.log("warn", "slow_request", {
        path: rec.path,
        method: rec.method,
        status: String(rec.status),
        duration_ms: String(rec.durationMs),
      });
    }
  },

  log(
    level: LogLevel,
    message: string,
    fields: Record<string, string> = {},
  ): void {
    const line = `[${level.toUpperCase()}] ${message} ${JSON.stringify(fields)}`;
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      line,
    );
  },
};
