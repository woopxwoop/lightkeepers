/**
 * Server-side proxy to the lightkeepers-agent research API.
 * Bearer token stays on the server — never sent to the browser.
 */

import { env } from "$env/dynamic/private";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import type { ResearchRequest, ResearchResponse } from "$lib/research-types";

/** Gemini + retrieval can be slow over a tunnel. */
const RESEARCH_TIMEOUT_MS = 120_000;

export class ResearchAgentError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResearchAgentError";
    this.status = status;
  }
}

export async function fetchResearch(
  body: ResearchRequest,
): Promise<ResearchResponse> {
  const baseUrl = env.RESEARCH_AGENT_URL?.replace(/\/$/, "");
  const token = env.RESEARCH_API_TOKEN;
  if (!baseUrl || !token) {
    throw new ResearchAgentError(
      503,
      "Research agent is not configured (RESEARCH_AGENT_URL / RESEARCH_API_TOKEN).",
    );
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl}/v1/research`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
      RESEARCH_TIMEOUT_MS,
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Research agent request timed out."
        : "Could not reach the research agent.";
    throw new ResearchAgentError(502, msg);
  }

  if (!res.ok) {
    let detail = (await res.text()).trim();
    try {
      const payload = JSON.parse(detail) as { detail?: string };
      if (typeof payload.detail === "string" && payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // keep raw text
    }
    throw new ResearchAgentError(
      res.status,
      detail || `Research agent returned HTTP ${res.status}.`,
    );
  }

  return (await res.json()) as ResearchResponse;
}
