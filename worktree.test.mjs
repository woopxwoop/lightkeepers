/**
 * Run: pnpm exec tsx --test worktree.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAgentFile,
  envKey,
  keepAgentFile,
  keptAgentName,
  mergeEnvText,
} from "./worktree.mjs";

describe("mergeEnvText", () => {
  it("appends keys develop does not have", () => {
    const merged = mergeEnvText(
      "PUBLIC_SUPABASE_URL=http://local\n",
      "PUBLIC_SUPABASE_URL=http://other\nRESEARCH_API_TOKEN=secret\n",
      "implicit-states",
    );
    assert.deepEqual(merged.added, ["RESEARCH_API_TOKEN"]);
    assert.deepEqual(merged.existing, ["PUBLIC_SUPABASE_URL"]);
    assert.match(merged.text, /PUBLIC_SUPABASE_URL=http:\/\/local\n/);
    assert.match(merged.text, /# Added from worktree implicit-states\n/);
    assert.match(merged.text, /RESEARCH_API_TOKEN=secret\n/);
    assert.equal(merged.text.includes("http://other"), false);
  });

  it("ignores comments and blank lines", () => {
    const merged = mergeEnvText("A=1\n", "# B=2\n\nexport C=3\n", "notes");
    assert.deepEqual(merged.added, ["C"]);
    assert.equal(envKey("# B=2"), null);
    assert.equal(envKey("export C=3"), "C");
  });

  it("leaves develop unchanged when every key is already set", () => {
    const develop = "A=1\n";
    const merged = mergeEnvText(develop, "A=2\n", "notes");
    assert.equal(merged.text, develop);
    assert.deepEqual(merged.added, []);
  });
});

describe("classifyAgentFile", () => {
  it("copies a file develop does not have", () => {
    assert.equal(
      classifyAgentFile({
        developExists: false,
        sameContent: false,
        worktreeMtimeMs: 1,
        developMtimeMs: 0,
      }),
      "copy",
    );
  });

  it("skips identical files", () => {
    assert.equal(
      classifyAgentFile({
        developExists: true,
        sameContent: true,
        worktreeMtimeMs: 10,
        developMtimeMs: 1,
      }),
      "skip",
    );
  });

  it("copies a newer worktree learning over develop", () => {
    assert.equal(
      classifyAgentFile({
        developExists: true,
        sameContent: false,
        worktreeMtimeMs: 10,
        developMtimeMs: 5,
      }),
      "copy",
    );
  });

  it("keeps a newer develop file", () => {
    assert.equal(
      classifyAgentFile({
        developExists: true,
        sameContent: false,
        worktreeMtimeMs: 5,
        developMtimeMs: 10,
      }),
      "keep-develop",
    );
  });
});

describe("agent path filters", () => {
  it("names a kept copy beside the develop file", () => {
    assert.equal(
      keptAgentName("SKILL.md", "implicit-states"),
      "SKILL.from-implicit-states.md",
    );
    assert.equal(
      keptAgentName("AGENTS.md", "implicit-states"),
      "AGENTS.from-implicit-states.md",
    );
  });

  it("skips run state and verification artifacts", () => {
    const root = "C:/repo/.cursor";
    assert.equal(
      keepAgentFile(root, "C:/repo/.cursor/skills/foo/SKILL.md"),
      true,
    );
    assert.equal(
      keepAgentFile(
        root,
        "C:/repo/.cursor/skills/verify-lightkeepers/.run/state.json",
      ),
      false,
    );
    assert.equal(
      keepAgentFile(
        root,
        "C:/repo/.cursor/skills/verify-lightkeepers/artifacts/abyss/board.png",
      ),
      false,
    );
    assert.equal(
      keepAgentFile(
        root,
        "C:/repo/.cursor/skills/verify-lightkeepers/artifacts/.gitkeep",
      ),
      true,
    );
  });
});
