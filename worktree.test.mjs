/**
 * Run: pnpm exec tsx --test worktree.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  carryPaths,
  classifyAgentFile,
  envKey,
  keepAgentFile,
  keptAgentName,
  liveBranches,
  mergeEnvText,
  parseWorktrees,
  shouldPruneBranch,
  uncarriedIgnored,
  unionPaths,
} from "./worktree.mjs";

describe("carryPaths", () => {
  const gitignore = [
    "node_modules",
    "AGENTS.md",
    "",
    "# worktree:carry — local-only paths",
    "# Plain root paths only",
    "AGENTS.md",
    ".claude/",
    "/docs",
    "AGENTS.md",
    "*.md",
    "!keep.md",
    "../outside",
    "# worktree:end",
    "/scripts/",
  ].join("\r\n");

  it("reads plain paths between the markers, normalised and deduped", () => {
    assert.deepEqual(carryPaths(gitignore).paths, [
      "AGENTS.md",
      ".claude",
      "docs",
    ]);
  });

  it("reports globs, negations, and parent escapes instead of carrying them", () => {
    assert.deepEqual(carryPaths(gitignore).skipped, [
      "*.md",
      "!keep.md",
      "../outside",
    ]);
  });

  it("carries nothing without a block", () => {
    assert.deepEqual(carryPaths("AGENTS.md\n/docs\n"), {
      paths: [],
      skipped: [],
    });
  });

  it("unions develop and worktree lists so branch-only paths come back", () => {
    assert.deepEqual(unionPaths(["AGENTS.md", "docs"], ["docs", "notes"]), [
      "AGENTS.md",
      "docs",
      "notes",
    ]);
  });
});

describe("uncarriedIgnored", () => {
  it("lists ignored entries that are neither carried nor build noise", () => {
    const ignored = [
      ".env",
      ".claude/",
      "docs/",
      "node_modules/",
      ".svelte-kit/",
      "scripts/",
      "src/lib/__pycache__/",
      "dev.server.log",
      "Me_export.json",
    ];
    assert.deepEqual(uncarriedIgnored(ignored, [".claude", "docs"]), [
      "scripts/",
      "Me_export.json",
    ]);
  });

  it("treats a collapsed parent of a carried path as covered", () => {
    assert.deepEqual(uncarriedIgnored(["docs/"], ["docs/design"]), []);
  });
});

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

describe("prune", () => {
  const porcelain = [
    "worktree C:/repo/lightkeepers-develop",
    "HEAD d96223e",
    "branch refs/heads/develop",
    "",
    "worktree C:/repo/lightkeepers-implicit-states",
    "HEAD 438bcad",
    "branch refs/heads/implicit-states",
    "",
    "worktree C:/repo/lightkeepers-tier-list",
    "HEAD 83a2e35",
    "branch refs/heads/tier-list",
    "prunable gitdir file points to non-existent location",
    "",
  ].join("\r\n");

  it("marks worktree entries whose folder is gone as prunable", () => {
    const entries = parseWorktrees(porcelain);
    assert.deepEqual(
      entries.map((e) => [e.branch, e.prunable]),
      [
        ["refs/heads/develop", false],
        ["refs/heads/implicit-states", false],
        ["refs/heads/tier-list", true],
      ],
    );
  });

  it("treats only branches in existing worktrees as live", () => {
    assert.deepEqual(
      [...liveBranches(parseWorktrees(porcelain))],
      ["develop", "implicit-states"],
    );
  });

  it("never prunes develop, main, or a live worktree branch", () => {
    const live = new Set(["develop", "implicit-states"]);
    assert.equal(shouldPruneBranch("develop", live), false);
    assert.equal(shouldPruneBranch("main", live), false);
    assert.equal(shouldPruneBranch("implicit-states", live), false);
  });

  it("prunes an ordinary merged feature branch", () => {
    assert.equal(shouldPruneBranch("tier-list", new Set(["develop"])), true);
  });
});
