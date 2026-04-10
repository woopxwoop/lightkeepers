/**
 * src/lib/server/metrics.ts
 *
 * Pushes metrics and logs to Grafana Cloud via OTLP HTTP.
 *
 * Metrics: https://otlp-gateway-prod-us-east-2.grafana.net/otlp/v1/metrics
 * Logs:    https://otlp-gateway-prod-us-east-2.grafana.net/otlp/v1/logs
 *
 * Auth: Basic base64(GRAFANA_USER:GRAFANA_TOKEN)
 */

// ── Config ─────────────────────────────────────────────────────────────────

const OTLP_BASE = process.env.GRAFANA_OTLP_BASE ?? "";
const GF_USER = process.env.GRAFANA_USER ?? "";
const GF_TOKEN = process.env.GRAFANA_TOKEN ?? "";

const METRICS_URL = `${OTLP_BASE}/v1/metrics`;
const LOGS_URL = `${OTLP_BASE}/v1/logs`;

const SERVICE = "lightkeepers";
const FLUSH_INTERVAL_MS = 30_000;
const SLOW_REQUEST_MS = 2_000;

const enabled = Boolean(OTLP_BASE && GF_USER && GF_TOKEN);
if (!enabled) {
  console.warn("[metrics] Grafana env vars not set — metrics/logs disabled");
}

// ── Types ──────────────────────────────────────────────────────────────────

export type RequestRecord = {
  path: string;
  method: string;
  status: number;
  durationMs: number;
};

type LogLevel = "info" | "warn" | "error";

// ── In-memory accumulators ─────────────────────────────────────────────────

const requestCounts = new Map<string, number>();
const requestDurations = new Map<string, number[]>();
const labelCache = new Map<string, Record<string, string>>();

type LogEntry = {
  timeUnixNano: string;
  severityText: string;
  body: { stringValue: string };
  attributes: unknown[];
};
const logQueue: LogEntry[] = [];

// ── Helpers ────────────────────────────────────────────────────────────────

function makeKey(labels: Record<string, string>): string {
  const key = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  labelCache.set(key, labels);
  return key;
}

function toAttributes(labels: Record<string, string>) {
  return Object.entries(labels).map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}

function basicAuth(): string {
  return `Basic ${Buffer.from(`${GF_USER}:${GF_TOKEN}`).toString("base64")}`;
}

function nowNano(): string {
  // Date.now() is ms — OTLP wants nanoseconds as a string
  return `${Date.now()}000000`;
}

// ── Public API ─────────────────────────────────────────────────────────────

export const metrics = {
  recordRequest(rec: RequestRecord): void {
    const labels = {
      service: SERVICE,
      path: rec.path,
      method: rec.method,
      status: String(rec.status),
      status_class: `${Math.floor(rec.status / 100)}xx`,
    };
    const key = makeKey(labels);

    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);

    const durations = requestDurations.get(key) ?? [];
    durations.push(rec.durationMs);
    requestDurations.set(key, durations);

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
    // Always write to stdout — visible in `docker compose logs`.
    const line = `[${level.toUpperCase()}] ${message} ${JSON.stringify(fields)}`;

    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      line,
    );

    if (!enabled) return;

    logQueue.push({
      timeUnixNano: nowNano(),
      severityText: level.toUpperCase(),
      body: { stringValue: message }, // just the msg string, not the whole JSON
      attributes: toAttributes({ level, service: SERVICE, ...fields }),
    });
  },

  async flush(): Promise<void> {
    if (!enabled) return;
    await Promise.allSettled([flushMetrics(), flushLogs()]);
  },
};

// ── OTLP metrics flush ─────────────────────────────────────────────────────

async function flushMetrics(): Promise<void> {
  if (requestCounts.size === 0) return;

  const timeUnixNano = nowNano();
  const counterPoints: unknown[] = [];
  const summaryPoints: unknown[] = [];

  for (const [key, count] of requestCounts) {
    const labels = labelCache.get(key) ?? {};
    const attributes = toAttributes(labels);

    counterPoints.push({ attributes, asInt: count, timeUnixNano });

    const durations = requestDurations.get(key) ?? [];
    if (durations.length > 0) {
      const sorted = [...durations].sort((a, b) => a - b);
      const sum = sorted.reduce((s, v) => s + v, 0);
      const p = (q: number) =>
        sorted[Math.min(Math.floor(q * sorted.length), sorted.length - 1)];

      summaryPoints.push({
        attributes,
        timeUnixNano,
        count: sorted.length,
        sum,
        quantileValues: [
          { quantile: 0.5, value: p(0.5) },
          { quantile: 0.95, value: p(0.95) },
          { quantile: 0.99, value: p(0.99) },
        ],
      });
    }
  }

  // Clear before the await so a failed push doesn't double-count on retry.
  requestCounts.clear();
  requestDurations.clear();

  const body = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: SERVICE } },
          ],
        },
        scopeMetrics: [
          {
            metrics: [
              {
                name: "http_requests_total",
                description: "Total HTTP requests handled",
                unit: "1",
                sum: {
                  dataPoints: counterPoints,
                  aggregationTemporality: 2, // DELTA — we reset counters each flush
                  isMonotonic: true,
                },
              },
              {
                name: "http_request_duration_ms",
                description: "HTTP request duration in milliseconds",
                unit: "ms",
                summary: {
                  dataPoints: summaryPoints,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(METRICS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        "[metrics] OTLP metrics push failed",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("[metrics] OTLP metrics push error", err);
  }
}

// ── OTLP logs flush ────────────────────────────────────────────────────────

async function flushLogs(): Promise<void> {
  if (logQueue.length === 0) return;

  const entries = logQueue.splice(0, logQueue.length);

  const body = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: SERVICE } },
          ],
        },
        scopeLogs: [
          {
            logRecords: entries,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(LOGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        "[metrics] OTLP logs push failed",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("[metrics] OTLP logs push error", err);
  }
}

// ── Auto-flush ─────────────────────────────────────────────────────────────

const flushTimer = setInterval(() => {
  metrics.flush().catch(console.error);
}, FLUSH_INTERVAL_MS);

flushTimer.unref();

process.once("SIGTERM", () => {
  metrics.flush().catch(console.error);
});
process.once("SIGINT", () => {
  metrics.flush().catch(console.error);
});
