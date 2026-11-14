/**
 * Validator for the dev-only `/api/research` body: bounded question and focus
 * list, enum options, and only the fields the research agent should receive.
 */
import { error } from "@sveltejs/kit";
import type {
  ResearchAnswerStyle,
  ResearchLlmProvider,
  ResearchQuestionKind,
  ResearchRequest,
} from "#lib/research/research-types.js";

export const MAX_RESEARCH_QUESTION_LENGTH = 2000;
export const MAX_RESEARCH_FOCUS_IDS = 8;

const RESEARCH_QUESTION_KINDS = [
  "how_to_play",
  "ask",
] as const satisfies readonly ResearchQuestionKind[];
const RESEARCH_LLM_PROVIDERS = [
  "gemini",
  "deepseek",
] as const satisfies readonly ResearchLlmProvider[];
const RESEARCH_MODES = [
  "abyss",
  "stygian",
] as const satisfies readonly NonNullable<ResearchRequest["mode"]>[];
const RESEARCH_ANSWER_STYLES = [
  "concise",
  "normal",
  "verbose",
] as const satisfies readonly ResearchAnswerStyle[];

/** Absent → `undefined`; otherwise one of `allowed` or 400. */
function optionalOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message: string,
): T | undefined {
  // JSON clients often send unset options as null.
  if (value === undefined || value === null) return undefined;
  if (!allowed.includes(value as T)) throw error(400, message);
  return value as T;
}

function requireResearchFocusNameIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw error(400, "focus_name_ids must be an array.");
  }
  if (value.length > MAX_RESEARCH_FOCUS_IDS) {
    throw error(
      400,
      `focus_name_ids must have at most ${MAX_RESEARCH_FOCUS_IDS} entries.`,
    );
  }
  return value.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
}

/** Validated `/api/research` body; only fields the agent should receive. */
export function requireResearchRequest(
  body: Record<string, unknown>,
): ResearchRequest {
  const topic = body.topic === "build" ? "build" : undefined;
  const focus_name_ids = requireResearchFocusNameIds(body.focus_name_ids);
  if (topic === "build" && focus_name_ids.length === 0) {
    throw error(400, "topic=build requires focus_name_ids.");
  }

  const asked = typeof body.question === "string" ? body.question.trim() : "";
  if (asked.length > MAX_RESEARCH_QUESTION_LENGTH) {
    throw error(
      400,
      `question must be at most ${MAX_RESEARCH_QUESTION_LENGTH} characters.`,
    );
  }
  const question =
    asked ||
    (topic === "build" ? `How should I build ${focus_name_ids[0]}?` : "");
  if (!question) throw error(400, "question is required.");

  const question_kind =
    topic === "build"
      ? "ask"
      : (optionalOneOf(
          body.question_kind,
          RESEARCH_QUESTION_KINDS,
          "question_kind must be how_to_play or ask.",
        ) ?? "ask");

  return {
    topic,
    question_kind,
    question,
    focus_name_ids,
    llm_provider: optionalOneOf(
      body.llm_provider,
      RESEARCH_LLM_PROVIDERS,
      "llm_provider must be gemini or deepseek.",
    ),
    mode: optionalOneOf(
      body.mode,
      RESEARCH_MODES,
      "mode must be abyss or stygian.",
    ),
    answer_style: optionalOneOf(
      body.answer_style,
      RESEARCH_ANSWER_STYLES,
      "answer_style must be concise, normal, or verbose.",
    ),
  };
}
