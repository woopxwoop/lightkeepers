/** Client fetch for dev research chat → /api/research proxy. */

import type {
  ResearchRequest,
  ResearchResponse,
  ResearchLlmProvider,
} from "$lib/research-types";

/** Match server research agent budget so stalled chat requests recover. */
const RESEARCH_FETCH_TIMEOUT_MS = 120_000;

function parseApiError(status: number, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const payload = JSON.parse(trimmed) as {
      message?: string;
      detail?: string | { msg?: string }[];
    };
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail) {
      return payload.detail;
    }
    if (Array.isArray(payload.detail)) {
      const msgs = payload.detail
        .map((d) => d?.msg)
        .filter((m): m is string => typeof m === "string" && Boolean(m));
      if (msgs.length > 0) return msgs.join("; ");
    }
  } catch {
    // plain text / html from upstream
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}

function parseOkJson<T>(status: number, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(parseApiError(status, text));
  }
}

export async function postResearchChat(
  body: ResearchRequest,
): Promise<ResearchResponse> {
  let res: Response;
  try {
    res = await fetch("/api/research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESEARCH_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (
      (err instanceof Error && err.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "TimeoutError")
    ) {
      throw new Error("Research request timed out.");
    }
    throw err instanceof Error ? err : new Error("Research request failed");
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }

  return parseOkJson<ResearchResponse>(res.status, text);
}

export type ResearchProxyHealth = {
  configured: boolean;
  agentUrl: string | null;
  agent: {
    ok: boolean;
    body?: unknown;
    geminiConfigured?: boolean;
    deepseekConfigured?: boolean;
    defaultLlmProvider?: ResearchLlmProvider;
    error?: string;
  };
};

export async function fetchResearchProxyHealth(): Promise<ResearchProxyHealth> {
  const res = await fetch("/api/research", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }
  return parseOkJson<ResearchProxyHealth>(res.status, text);
}
