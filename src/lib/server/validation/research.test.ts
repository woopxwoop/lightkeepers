import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_RESEARCH_FOCUS_IDS,
  MAX_RESEARCH_QUESTION_LENGTH,
  requireResearchRequest,
} from "./research.ts";

const isBadRequest = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === 400;

describe("research request validation", () => {
  it("requireResearchRequest defaults build questions and requires focus", () => {
    assert.deepEqual(
      requireResearchRequest({
        topic: "build",
        focus_name_ids: ["Xingqiu", "", "  ", 3],
        question_kind: "how_to_play",
      }),
      {
        topic: "build",
        question_kind: "ask",
        question: "How should I build Xingqiu?",
        focus_name_ids: ["Xingqiu"],
        llm_provider: undefined,
        mode: undefined,
        answer_style: undefined,
      },
    );
    assert.throws(
      () => requireResearchRequest({ topic: "build", question: "Hi?" }),
      isBadRequest,
    );
    assert.throws(
      () => requireResearchRequest({ topic: "build", focus_name_ids: [""] }),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireResearchRequest({ focus_name_ids: "Xingqiu", question: "x" }),
      isBadRequest,
    );
  });

  it("requireResearchRequest treats null options as absent", () => {
    const research = requireResearchRequest({
      topic: "build",
      focus_name_ids: ["Xingqiu", "", "  ", 3],
      question_kind: "how_to_play",
      mode: null,
      llm_provider: null,
      answer_style: null,
    });
    assert.equal(research.mode, undefined);
    assert.equal(research.llm_provider, undefined);
    assert.equal(research.answer_style, undefined);
  });

  it("requireResearchRequest bounds the question and focus list", () => {
    assert.throws(() => requireResearchRequest({}), isBadRequest);
    assert.throws(
      () => requireResearchRequest({ question: "   " }),
      isBadRequest,
    );
    assert.throws(() => requireResearchRequest({ question: 42 }), isBadRequest);
    assert.equal(
      requireResearchRequest({
        question: "x".repeat(MAX_RESEARCH_QUESTION_LENGTH),
      }).question?.length,
      MAX_RESEARCH_QUESTION_LENGTH,
    );
    assert.throws(
      () =>
        requireResearchRequest({
          question: "x".repeat(MAX_RESEARCH_QUESTION_LENGTH + 1),
        }),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireResearchRequest({
          question: "Who is best?",
          focus_name_ids: Array.from(
            { length: MAX_RESEARCH_FOCUS_IDS + 1 },
            (_, i) => `c${i}`,
          ),
        }),
      isBadRequest,
    );
  });

  it("requireResearchRequest validates enums and drops unknown keys", () => {
    const research = requireResearchRequest({
      question: "  How do I play Furina?  ",
      question_kind: "how_to_play",
      llm_provider: "deepseek",
      mode: "stygian",
      answer_style: "verbose",
      owned_characters: [{ name_id: "Furina" }],
      owned_weapons: [{ key: "StaffOfHoma" }],
      roster_name_ids: ["Furina"],
      personalize: true,
    });
    assert.deepEqual(research, {
      topic: undefined,
      question_kind: "how_to_play",
      question: "How do I play Furina?",
      focus_name_ids: [],
      llm_provider: "deepseek",
      mode: "stygian",
      answer_style: "verbose",
    });
    assert.ok(!("owned_characters" in research));
    assert.ok(!("personalize" in research));
    assert.equal(
      requireResearchRequest({ question: "x", topic: "other" }).topic,
      undefined,
    );
    assert.equal(
      requireResearchRequest({ question: "x" }).question_kind,
      "ask",
    );

    for (const [key, value] of [
      ["llm_provider", "openai"],
      ["mode", "simulated"],
      ["answer_style", "terse"],
      ["question_kind", "chat"],
    ] as const) {
      assert.throws(
        () => requireResearchRequest({ question: "x", [key]: value }),
        isBadRequest,
      );
    }
  });
});
