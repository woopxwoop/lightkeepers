/** Client fetch for dev research chat → /api/research proxy. */

import type { ResearchRequest, ResearchResponse, ResearchLlmProvider } from "$lib/research-types";

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
    if (Array.isArray(payload.detail) && payload.detail[0]?.msg) {
      return payload.detail.map((d) => d.msg).join("; ");
    }
  } catch {
    // plain text / html from upstream
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}

export async function postResearchChat(
  body: ResearchRequest,
): Promise<ResearchResponse> {
  const res = await fetch("/api/research", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }

  return JSON.parse(text) as ResearchResponse;
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
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }
  return JSON.parse(text) as ResearchProxyHealth;
}
