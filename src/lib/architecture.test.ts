/**
 * Run: pnpm exec tsx --test src/lib/architecture.test.ts
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  boardsLane,
  componentSize,
  importStyle,
  importsOf,
  loadSourceFiles,
  modalShell,
  noBarrels,
  oneSupabaseClient,
  oneValkeyClient,
  resolveSpec,
  rosterStoreOneWriter,
  serverBoundary,
  staleLargeComponentBudgets,
  staleLegacyModalShells,
  staticDataLane,
  type SourceFile,
} from "./architecture-rules.ts";

const repo = loadSourceFiles(path.resolve(import.meta.dirname, "../.."));

const file = (filePath: string, text: string): SourceFile => ({
  path: filePath,
  text,
});

describe("scanner", () => {
  it("finds static, re-export, side-effect and dynamic imports, ignoring comments", () => {
    const refs = importsOf(
      file(
        "src/lib/x.ts",
        [
          'import a from "#lib/a.js";',
          "import {",
          "  b,",
          '} from "./b.js";',
          'export * from "#lib/c.js";',
          'import "#lib/d.css";',
          'const e = await import("#lib/e.js");',
          '// import f from "#lib/f.js";',
          '/* import("#lib/g.svelte") */',
          'const url = "https://example.com/x";',
        ].join("\n"),
      ),
    );
    assert.deepEqual(refs, [
      { spec: "#lib/a.js", line: 1 },
      { spec: "./b.js", line: 2 },
      { spec: "#lib/c.js", line: 5 },
      { spec: "#lib/d.css", line: 6 },
      { spec: "#lib/e.js", line: 7 },
    ]);
  });

  it("ignores HTML comments in .svelte files", () => {
    const refs = importsOf(
      file(
        "src/lib/ui/components/X.svelte",
        '<!-- import("#lib/ui/components/SomeSheet.svelte") -->\n<script lang="ts">\n  import Y from "#lib/ui/components/Y.svelte";\n</script>\n',
      ),
    );
    assert.deepEqual(refs, [{ spec: "#lib/ui/components/Y.svelte", line: 3 }]);
  });

  it("resolves #lib and relative specs, not packages or $app", () => {
    assert.equal(
      resolveSpec("src/routes/a/+page.svelte", "#lib/x.js"),
      "src/lib/x.js",
    );
    assert.equal(resolveSpec("src/lib/a/b.ts", "../c/d.js"), "src/lib/c/d.js");
    assert.equal(resolveSpec("src/lib/a/b.ts", "./e.js"), "src/lib/a/e.js");
    assert.equal(resolveSpec("src/lib/a/b.ts", "svelte/store"), null);
    assert.equal(resolveSpec("src/lib/a/b.ts", "$app/env/private"), null);
  });
});

describe("rule 1: static data lane", () => {
  it("repo has no violations", () => {
    assert.deepEqual(staticDataLane(repo), []);
  });

  it("flags JSON from src/lib/data outside equipment-data.ts", () => {
    const violations = staticDataLane([
      file(
        "src/lib/boards/x.ts",
        'import bases from "#lib/data/weapon-bases.json";',
      ),
      file(
        "src/lib/ui/Y.svelte",
        '<script>\n  const m = import("../data/artifact-sets.json");\n</script>',
      ),
    ]);
    assert.equal(violations.length, 2);
  });
});

describe("rule 2: modal shell", () => {
  it("repo has no violations", () => {
    assert.deepEqual(modalShell(repo), []);
  });

  it("flags focus-trap / body-scroll-lock outside the shell owners", () => {
    const violations = modalShell([
      file(
        "src/lib/ui/components/NewPopup.svelte",
        '<script lang="ts">\n  import { trapTabKey } from "#lib/ui/focus-trap.js";\n</script>',
      ),
    ]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].line, 2);
  });

  it("ratchet: every LEGACY_MODAL_SHELLS entry still copies the shell", () => {
    assert.deepEqual(staleLegacyModalShells(repo), []);
    const fixed = file(
      "src/lib/ui/components/OldPopup.svelte",
      '<script lang="ts">\n</script>',
    );
    assert.deepEqual(staleLegacyModalShells([fixed], [fixed.path]), [
      {
        file: fixed.path,
        line: 1,
        message: `${fixed.path} no longer copies the modal shell — remove it from LEGACY_MODAL_SHELLS`,
      },
    ]);
  });
});

describe("rule 3: no barrels", () => {
  it("repo has no violations", () => {
    assert.deepEqual(noBarrels(repo), []);
  });

  it("flags index.ts / index.js under src/lib", () => {
    const violations = noBarrels([
      file("src/lib/index.ts", 'export * from "#lib/utils.js";'),
      file("src/lib/boards/index.js", ""),
    ]);
    assert.equal(violations.length, 2);
  });
});

describe("rule 4: server boundary", () => {
  it("repo has no violations", () => {
    assert.deepEqual(serverBoundary(repo), []);
  });

  it("flags server-only imports from client-reachable modules", () => {
    const fixtures = file(
      "src/lib/e2e/fixtures.ts",
      'import { cache } from "#lib/server/cache.js";',
    );
    const violations = serverBoundary([
      file(
        "src/lib/stores/x.ts",
        'import { cache } from "#lib/server/cache.js";',
      ),
      file(
        "src/routes/+page.svelte",
        '<script>\n  import { env } from "$app/env/private";\n</script>',
      ),
      file(
        "src/routes/+page.ts",
        'import { serverDb } from "../lib/server/supabaseServer.js";',
      ),
      file(
        "src/routes/+page.server.ts",
        'import { cache } from "#lib/server/cache.js";',
      ),
      fixtures,
      file(
        "src/lib/ui/Z.svelte",
        '<script>\n  import { e2eCharacters } from "#lib/e2e/fixtures.js";\n</script>',
      ),
    ]);
    assert.deepEqual(
      violations.map((v) => v.file),
      [
        "src/lib/stores/x.ts",
        "src/routes/+page.svelte",
        "src/routes/+page.ts",
        fixtures.path,
      ],
    );
  });
});

describe("rule 5: import style", () => {
  it("repo has no violations", () => {
    assert.deepEqual(importStyle(repo), []);
  });

  it("flags ../ in src/lib and #lib specs without an extension", () => {
    const violations = importStyle([
      file(
        "src/lib/boards/x.ts",
        'import { a } from "../utils.js";\nimport { b } from "./y.js";',
      ),
      file(
        "src/routes/+page.svelte",
        '<script>\n  import { c } from "#lib/utils";\n</script>',
      ),
      file("src/routes/+page.ts", 'import type { PageLoad } from "./$types";'),
    ]);
    assert.deepEqual(
      violations.map((v) => [v.file, v.line]),
      [
        ["src/lib/boards/x.ts", 1],
        ["src/routes/+page.svelte", 2],
      ],
    );
  });
});

describe("rule 6: roster store has one writer", () => {
  it("repo has no violations", () => {
    assert.deepEqual(rosterStoreOneWriter(repo), []);
  });

  it("flags charactersOwned.set / .update outside roster-sync.ts", () => {
    const violations = rosterStoreOneWriter([
      file(
        "src/lib/app/x.ts",
        "charactersOwned.set([]);\n// charactersOwned.set([]);",
      ),
      file(
        "src/routes/+page.svelte",
        "<script>\n  charactersOwned.update((r) => r);\n</script>",
      ),
      file("src/lib/app/roster-sync.ts", "charactersOwned.set([]);"),
    ]);
    assert.deepEqual(
      violations.map((v) => [v.file, v.line]),
      [
        ["src/lib/app/x.ts", 1],
        ["src/routes/+page.svelte", 2],
      ],
    );
  });
});

describe("rule 7: boards lane", () => {
  it("repo has no violations", () => {
    assert.deepEqual(boardsLane(repo), []);
  });

  it("flags /api/static literals outside stores/boards.ts", () => {
    const violations = boardsLane([
      file(
        "src/lib/app/x.ts",
        'await fetch("/api/static");\n// fetch("/api/static")',
      ),
      file("src/lib/app/y.ts", "const url = `/api/static?_=${Date.now()}`;"),
      file("src/lib/stores/boards.ts", 'await fetch("/api/static");'),
      file("src/routes/api/teams/+server.ts", 'const k = "/api/static";'),
    ]);
    assert.deepEqual(
      violations.map((v) => [v.file, v.line]),
      [
        ["src/lib/app/x.ts", 1],
        ["src/lib/app/y.ts", 1],
      ],
    );
  });
});

describe("rule 8: component size", () => {
  const lines = (n: number) =>
    Array.from({ length: n }, () => "<p></p>").join("\n");

  it("repo has no violations", () => {
    assert.deepEqual(componentSize(repo), []);
  });

  it("flags unlisted components over 600 lines and listed ones over budget", () => {
    const violations = componentSize(
      [
        file("src/lib/ui/components/Big.svelte", lines(601)),
        file("src/lib/ui/components/Ok.svelte", lines(600)),
        file("src/lib/ui/components/Listed.svelte", lines(701)),
        file("src/lib/ui/components/Held.svelte", lines(700)),
      ],
      {
        "src/lib/ui/components/Listed.svelte": 700,
        "src/lib/ui/components/Held.svelte": 700,
      },
    );
    assert.deepEqual(
      violations.map((v) => v.file),
      [
        "src/lib/ui/components/Big.svelte",
        "src/lib/ui/components/Listed.svelte",
      ],
    );
  });

  it("ratchet: every LARGE_COMPONENT_BUDGETS entry is still oversized", () => {
    assert.deepEqual(staleLargeComponentBudgets(repo), []);
    const split = file("src/lib/ui/components/WasBig.svelte", lines(600));
    const gone = "src/lib/ui/components/Deleted.svelte";
    assert.deepEqual(
      staleLargeComponentBudgets([split], { [split.path]: 900, [gone]: 900 }),
      [
        {
          file: split.path,
          line: 1,
          message: `${split.path} is now compliant — remove it from LARGE_COMPONENT_BUDGETS`,
        },
        {
          file: gone,
          line: 1,
          message: `${gone} is now compliant — remove it from LARGE_COMPONENT_BUDGETS`,
        },
      ],
    );
  });
});

describe("rule 9: one Supabase client", () => {
  it("repo has no violations", () => {
    assert.deepEqual(oneSupabaseClient(repo), []);
  });

  it("flags @supabase/supabase-js outside supabaseServer.ts", () => {
    const violations = oneSupabaseClient([
      file(
        "src/lib/server/x.ts",
        'import { createClient } from "@supabase/supabase-js";',
      ),
      file(
        "src/lib/y.ts",
        '// import x from "@supabase/supabase-js";\nimport type { SupabaseClient } from "@supabase/supabase-js";',
      ),
      file(
        "src/lib/server/supabaseServer.ts",
        'import { createClient } from "@supabase/supabase-js";',
      ),
    ]);
    assert.deepEqual(
      violations.map((v) => [v.file, v.line]),
      [
        ["src/lib/server/x.ts", 1],
        ["src/lib/y.ts", 2],
      ],
    );
  });
});

describe("rule 10: one Valkey client", () => {
  it("repo has no violations", () => {
    assert.deepEqual(oneValkeyClient(repo), []);
  });

  it("flags redis / @redis/* outside valkey.ts", () => {
    const violations = oneValkeyClient([
      file("src/lib/server/x.ts", 'import { createClient } from "redis";'),
      file("src/lib/server/y.ts", 'const m = await import("@redis/client");'),
      file("src/lib/server/valkey.ts", 'import { createClient } from "redis";'),
      file("src/lib/server/z.ts", 'import x from "redis-mock";'),
    ]);
    assert.deepEqual(
      violations.map((v) => v.file),
      ["src/lib/server/x.ts", "src/lib/server/y.ts"],
    );
  });
});
