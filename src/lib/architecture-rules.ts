/**
 * Architecture rules from AGENTS.md ("one entry point per concern"), checked
 * over comment-stripped source text. Pure functions over `SourceFile[]` so
 * architecture.test.ts can run them against the repo and against synthetic input.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type SourceFile = { path: string; text: string };
export type Violation = { file: string; line: number; message: string };
export type ImportRef = { spec: string; line: number };

const SOURCE_EXTENSIONS = new Set([".ts", ".js", ".svelte"]);

export function loadSourceFiles(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push({
          path: path.relative(root, full).split(path.sep).join("/"),
          text: readFileSync(full, "utf8"),
        });
      }
    }
  };
  walk(path.join(root, "src"));
  return files;
}

function isTest(filePath: string): boolean {
  return /\.(test|spec)\.ts$/.test(filePath);
}

// ── Comment stripping ────────────────────────────────────────────────────────
// Comments become spaces (newlines kept) so offsets and line numbers survive.

const REGEX_PREFIX_CHARS = new Set("(,=:[!&|?{};+-*%<>~^".split(""));
const REGEX_PREFIX_WORDS = new Set([
  "return",
  "typeof",
  "case",
  "in",
  "of",
  "delete",
  "void",
  "throw",
  "new",
  "else",
  "do",
  "yield",
  "await",
]);

const blank = (s: string) => s.replace(/[^\n]/g, " ");

function stripJsComments(src: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "tpl" = "code";
  const exprBraces: number[] = [];
  let lastSignificant = "";
  let lastWord = "";

  const regexAllowed = () =>
    lastSignificant === "" ||
    REGEX_PREFIX_CHARS.has(lastSignificant) ||
    REGEX_PREFIX_WORDS.has(lastWord);

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (mode === "tpl") {
      if (c === "\\") {
        out += src.slice(i, i + 2);
        i += 2;
      } else if (c === "`") {
        out += c;
        i++;
        mode = "code";
        lastSignificant = "`";
        lastWord = "";
      } else if (c === "$" && next === "{") {
        out += "${";
        i += 2;
        exprBraces.push(0);
        mode = "code";
        lastSignificant = "{";
        lastWord = "";
      } else {
        out += c;
        i++;
      }
      continue;
    }

    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") {
        j += src[j] === "\\" ? 2 : 1;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      lastSignificant = c;
      lastWord = "";
      continue;
    }
    if (c === "`") {
      out += c;
      i++;
      mode = "tpl";
      continue;
    }
    if (c === "/" && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        else if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) break;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      lastSignificant = "/";
      lastWord = "";
      continue;
    }

    if (exprBraces.length > 0) {
      const top = exprBraces.length - 1;
      if (c === "{") exprBraces[top]++;
      else if (c === "}") {
        if (exprBraces[top] === 0) {
          exprBraces.pop();
          out += c;
          i++;
          mode = "tpl";
          continue;
        }
        exprBraces[top]--;
      }
    }

    if (/[A-Za-z_$]/.test(c)) {
      const word = /^[A-Za-z0-9_$]+/.exec(src.slice(i, i + 64))![0];
      out += word;
      i += word.length;
      lastSignificant = "a";
      lastWord = word;
      continue;
    }
    if (!/\s/.test(c)) {
      lastSignificant = c;
      lastWord = "";
    }
    out += c;
    i++;
  }
  return out;
}

const strippedCache = new WeakMap<SourceFile, string>();

/** Source text with comments blanked out; `.svelte` also loses `<!-- -->`. */
function strippedText(file: SourceFile): string {
  const cached = strippedCache.get(file);
  if (cached !== undefined) return cached;
  let text: string;
  if (file.path.endsWith(".svelte")) {
    text = file.text
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(
        /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,
        (_m, open: string, body: string, close: string) =>
          open + stripJsComments(body) + close,
      );
  } else {
    text = stripJsComments(file.text);
  }
  strippedCache.set(file, text);
  return text;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

// ── Imports ──────────────────────────────────────────────────────────────────

const IMPORT_PATTERNS = [
  /\b(?:import|export)\b[^;'"`()]*?\bfrom\s*(["'])([^"'\n]+)\1/g,
  /\bimport\s*(["'])([^"'\n]+)\1/g,
  /\bimport\s*\(\s*(["'`])([^"'`\n]+)\1\s*\)/g,
];

export function importsOf(file: SourceFile): ImportRef[] {
  const text = strippedText(file);
  const refs: { spec: string; index: number }[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      refs.push({ spec: m[2], index: m.index });
    }
  }
  return refs
    .sort((a, b) => a.index - b.index)
    .map(({ spec, index }) => ({ spec, line: lineAt(text, index) }));
}

/** Repo-relative target of `spec`, or null for packages and `$app/*`. */
export function resolveSpec(fromPath: string, spec: string): string | null {
  if (spec.startsWith("#lib/")) return `src/lib/${spec.slice("#lib/".length)}`;
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return path.posix.normalize(
      path.posix.join(path.posix.dirname(fromPath), spec),
    );
  }
  return null;
}

/** `x.js` and `x.ts` name the same module (TS import convention). */
const moduleId = (p: string) =>
  p.replace(/\?.*$/, "").replace(/\.(js|ts)$/, "");

function resolvedImports(file: SourceFile) {
  return importsOf(file).map((ref) => ({
    ...ref,
    target: resolveSpec(file.path, ref.spec),
  }));
}

// ── Rule 1: static data lane ────────────────────────────────────────────────

const STATIC_DATA_OWNER = "src/lib/equipment/equipment-data.ts";

export function staticDataLane(files: SourceFile[]): Violation[] {
  const message =
    "Static game data loads through equipment-data.ts (ensureEquipmentData / ensureBaseStatData / ensureWeaponRefinements); import its lookups instead of the JSON.";
  return files
    .filter((f) => !isTest(f.path) && f.path !== STATIC_DATA_OWNER)
    .flatMap((f) =>
      resolvedImports(f)
        .filter(
          ({ target }) =>
            target?.startsWith("src/lib/data/") &&
            /\.json(\?.*)?$/.test(target),
        )
        .map(({ line }) => ({ file: f.path, line, message })),
    );
}

// ── Rule 2: modal shell (ratchet) ───────────────────────────────────────────

const MODAL_HELPERS = [
  "src/lib/ui/focus-trap.ts",
  "src/lib/ui/body-scroll-lock.ts",
].map(moduleId);

// Empty: every modal uses ModalSheet. Never add to this list.
const LEGACY_MODAL_SHELLS: readonly string[] = [];

const MODAL_HELPER_OWNERS = new Set<string>([
  "src/lib/ui/components/ModalSheet.svelte",
  "src/lib/ui/components/HoverTooltip.svelte",
  "src/lib/ui/components/NavMobileDrawer.svelte",
  // Calls clearOrphanBodyScrollLock() on navigation; it owns no shell.
  "src/routes/+layout.svelte",
  ...LEGACY_MODAL_SHELLS,
]);

const importsModalHelper = (file: SourceFile) =>
  resolvedImports(file).filter(
    ({ target }) => target !== null && MODAL_HELPERS.includes(moduleId(target)),
  );

export function modalShell(files: SourceFile[]): Violation[] {
  const message = "Modals/sheets use ModalSheet.svelte; don't copy the shell.";
  return files
    .filter((f) => !isTest(f.path) && !MODAL_HELPER_OWNERS.has(f.path))
    .flatMap((f) =>
      importsModalHelper(f).map(({ line }) => ({
        file: f.path,
        line,
        message,
      })),
    );
}

/** Every LEGACY_MODAL_SHELLS entry must still copy the shell, so the list only shrinks. */
export function staleLegacyModalShells(
  files: SourceFile[],
  legacy: readonly string[] = LEGACY_MODAL_SHELLS,
): Violation[] {
  const byPath = new Map(files.map((f) => [f.path, f]));
  return legacy
    .filter((p) => {
      const file = byPath.get(p);
      return !file || importsModalHelper(file).length === 0;
    })
    .map((p) => ({
      file: p,
      line: 1,
      message: `${p} no longer copies the modal shell — remove it from LEGACY_MODAL_SHELLS`,
    }));
}

// ── Rule 3: no barrels ──────────────────────────────────────────────────────

export function noBarrels(files: SourceFile[]): Violation[] {
  const message = "No #lib barrel — import the module you need.";
  return files
    .filter((f) => /^src\/lib\/(.+\/)?index\.(ts|js)$/.test(f.path))
    .map((f) => ({ file: f.path, line: 1, message }));
}

// ── Rule 4: server boundary ─────────────────────────────────────────────────

const SERVER_ROUTE_FILES = new Set([
  "+server.ts",
  "+page.server.ts",
  "+layout.server.ts",
]);
const SERVER_ROOT_FILES = new Set([
  "src/hooks.server.ts",
  "src/instrumentation.server.ts",
]);

function isServerFile(filePath: string): boolean {
  return (
    filePath.startsWith("src/lib/server/") ||
    SERVER_ROOT_FILES.has(filePath) ||
    (filePath.startsWith("src/routes/") &&
      SERVER_ROUTE_FILES.has(path.posix.basename(filePath)))
  );
}

/** src/lib/e2e files are server-only while every non-test importer is a server file. */
function serverOnlyE2eFiles(files: SourceFile[]): Set<string> {
  const e2e = files.filter((f) => f.path.startsWith("src/lib/e2e/"));
  const clientImported = new Set<string>();
  for (const f of files) {
    if (isTest(f.path) || isServerFile(f.path)) continue;
    for (const { target } of resolvedImports(f)) {
      if (target?.startsWith("src/lib/e2e/"))
        clientImported.add(moduleId(target));
    }
  }
  return new Set(
    e2e.map((f) => f.path).filter((p) => !clientImported.has(moduleId(p))),
  );
}

export function serverBoundary(files: SourceFile[]): Violation[] {
  const message =
    "Server-only code (src/lib/server, $app/env/private) can't be imported from client-reachable modules.";
  const serverE2e = serverOnlyE2eFiles(files);
  return files
    .filter(
      (f) => !isTest(f.path) && !isServerFile(f.path) && !serverE2e.has(f.path),
    )
    .filter((f) => f.path.startsWith("src/"))
    .flatMap((f) =>
      resolvedImports(f)
        .filter(
          ({ spec, target }) =>
            spec === "$app/env/private" ||
            target?.startsWith("src/lib/server/"),
        )
        .map(({ line }) => ({ file: f.path, line, message })),
    );
}

// ── Rule 5: import style ────────────────────────────────────────────────────

const LIB_SPEC_EXTENSION =
  /\.(js|ts|svelte|json|css|png|jpe?g|gif|webp|avif|svg|ico)$/;

export function importStyle(files: SourceFile[]): Violation[] {
  return files
    .filter((f) => !isTest(f.path))
    .flatMap((f) =>
      importsOf(f).flatMap(({ spec, line }) => {
        if (f.path.startsWith("src/lib/") && spec.startsWith("../")) {
          return [
            {
              file: f.path,
              line,
              message: `In-repo imports use #lib/... with a file extension: replace "${spec}" with its #lib/... path.`,
            },
          ];
        }
        if (
          spec.startsWith("#lib/") &&
          !LIB_SPEC_EXTENSION.test(spec.replace(/\?.*$/, ""))
        ) {
          return [
            {
              file: f.path,
              line,
              message: `In-repo imports use #lib/... with a file extension: add the extension to "${spec}" (e.g. .js for a .ts module).`,
            },
          ];
        }
        return [];
      }),
    );
}

// ── Rule 6: roster store has one writer ─────────────────────────────────────

const ROSTER_WRITER = "src/lib/app/roster-sync.ts";

export function rosterStoreOneWriter(files: SourceFile[]): Violation[] {
  const message =
    "charactersOwned is fed only by rosterSync() (app/roster-sync.ts); save through rosterSync().commit(...).";
  return files
    .filter((f) => !isTest(f.path) && f.path !== ROSTER_WRITER)
    .flatMap((f) => {
      const text = strippedText(f);
      return [
        ...text.matchAll(/\bcharactersOwned\s*\.\s*(?:set|update)\s*\(/g),
      ].map((m) => ({ file: f.path, line: lineAt(text, m.index), message }));
    });
}

// ── Rule 7: boards lane ─────────────────────────────────────────────────────

const BOARDS_OWNER = "src/lib/stores/boards.ts";
const STATIC_ROUTE_LITERAL = /(["'`])(?:(?!\1)[^\\\n]|\\.)*?\/api\/static/g;

export function boardsLane(files: SourceFile[]): Violation[] {
  const message =
    "Meta boards load through ensureStaticBoards() (stores/boards.ts).";
  return files
    .filter(
      (f) =>
        !isTest(f.path) &&
        f.path !== BOARDS_OWNER &&
        !f.path.startsWith("src/routes/api/"),
    )
    .flatMap((f) => {
      const text = strippedText(f);
      return [...text.matchAll(STATIC_ROUTE_LITERAL)].map((m) => ({
        file: f.path,
        line: lineAt(text, m.index),
        message,
      }));
    });
}
