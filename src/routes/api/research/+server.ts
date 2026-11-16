/**
 * POST /api/research — dev-only proxy to lightkeepers-agent /v1/research.
 * GET — dev diagnostics (env + agent /health).
 */
import { dev } from "$app/env";

import { RESEARCH_AGENT_URL, RESEARCH_API_TOKEN } from "$app/env/private";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { fetchWithTimeout } from "#lib/cdn-fetch.js";
import {
  E2E_RESEARCH_BUILD_RESPONSE,
  E2E_RESEARCH_RESPONSE,
} from "#lib/e2e/fixtures.js";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import { enforceApiRateLimit } from "#lib/server/rate-limit.js";
import { requireJsonObject } from "#lib/server/validation/core.js";
import { requireResearchRequest } from "#lib/server/validation/research.js";
import {
  ResearchAgentError,
  fetchResearch,
} from "#lib/server/research-agent.js";

/** SvelteKit `error()` only accepts 400–599. */
function httpErrorStatus(status: number): number {
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 502;
}

export const GET: RequestHandler = async () => {
  if (!dev) error(404, "Not found");

  if (isPlaywrightE2e()) {
    return Response.json({
      configured: true,
      agentUrl: "http://e2e.invalid",
      agent: {
        ok: true,
        geminiConfigured: true,
        deepseekConfigured: true,
        defaultLlmProvider: "gemini",
      },
    });
  }

  const agentUrl = RESEARCH_AGENT_URL?.replace(/\/$/, "") ?? null;
  const tokenSet = Boolean(RESEARCH_API_TOKEN);

  if (!agentUrl || !tokenSet) {
    return Response.json({
      configured: false,
      agentUrl,
      agent: {
        ok: false,
        error:
          "Set RESEARCH_AGENT_URL and RESEARCH_API_TOKEN in Lightkeepers .env",
      },
    });
  }

  try {
    const res = await fetchWithTimeout(`${agentUrl}/health`, {}, 8_000);
    const body = (await res.json().catch(() => null)) as unknown;
    return Response.json({
      configured: true,
      agentUrl,
      agent: {
        ok: res.ok,
        body,
        geminiConfigured: Boolean(
          body &&
          typeof body === "object" &&
          "gemini_configured" in body &&
          (body as { gemini_configured?: boolean }).gemini_configured,
        ),
        deepseekConfigured: Boolean(
          body &&
          typeof body === "object" &&
          "deepseek_configured" in body &&
          (body as { deepseek_configured?: boolean }).deepseek_configured,
        ),
        defaultLlmProvider:
          body &&
          typeof body === "object" &&
          "default_llm_provider" in body &&
          (body as { default_llm_provider?: string }).default_llm_provider ===
            "deepseek"
            ? "deepseek"
            : "gemini",
      },
    });
  } catch (err) {
    return Response.json({
      configured: true,
      agentUrl,
      agent: {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not reach research agent (is the SSH tunnel up?)",
      },
    });
  }
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  if (!dev) error(404, "Not found");

  const research = requireResearchRequest(await requireJsonObject(request));

  if (isPlaywrightE2e()) {
    const fixture =
      research.topic === "build"
        ? {
            ...E2E_RESEARCH_BUILD_RESPONSE,
            focus_name_id:
              research.focus_name_ids?.[0] ??
              E2E_RESEARCH_BUILD_RESPONSE.focus_name_id,
          }
        : E2E_RESEARCH_RESPONSE;
    return Response.json(fixture, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  try {
    // General-facts oracle: never forward inventory / personalize.
    const result = await fetchResearch(research);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ResearchAgentError) {
      console.error("[api/research]", err.status, err.message);
      error(httpErrorStatus(err.status), err.message);
    }
    console.error("[api/research] unexpected error", err);
    error(500, "Research proxy failed.");
  }
};
