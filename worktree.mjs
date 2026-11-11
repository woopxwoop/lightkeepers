import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
} from "node:path";
import { fileURLToPath } from "node:url";

/**
 * pnpm worktree <name>
 *   New branch from develop at ../lightkeepers-<name>.
 *   Copies .env, AGENTS.md, CLAUDE.md, .cursor, and .claude.
 *
 * pnpm worktree remove <name>
 *   Copies agent learnings back onto the main worktree, appends .env keys
 *   that develop does not have yet, then removes the worktree. The branch
 *   stays. A newer file on develop is left in place; the worktree copy is
 *   kept beside it as <name>.from-<worktree>.
 */

const agentPaths = ["AGENTS.md", "CLAUDE.md", ".cursor", ".claude"];

const USAGE = `Usage: pnpm worktree <name>
       pnpm worktree remove <name>

Creates ../lightkeepers-<name> on a new branch from develop and copies .env, AGENTS.md, CLAUDE.md, .cursor, and .claude.

remove folds those copies back into the main worktree first. New .env keys are appended. Existing keys are left as they are on develop. The branch is not deleted.`;

export function envKey(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const body = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;
  const eq = body.indexOf("=");
  if (eq <= 0) return null;
  const key = body.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  return key;
}

/** Append worktree env lines whose keys are absent from develop. */
export function mergeEnvText(developText, worktreeText, worktreeName) {
  const present = new Set();
  for (const line of developText.split(/\r?\n/)) {
    const key = envKey(line);
    if (key) present.add(key);
  }

  const added = [];
  const existing = [];
  const lines = [];
  for (const line of worktreeText.split(/\r?\n/)) {
    const key = envKey(line);
    if (!key) continue;
    if (present.has(key)) {
      if (!existing.includes(key)) existing.push(key);
      continue;
    }
    present.add(key);
    added.push(key);
    lines.push(line.replace(/\s+$/, ""));
  }

  if (added.length === 0) {
    return { text: developText, added, existing };
  }

  const base = developText.replace(/\s*$/, "");
  const block = [
    "",
    `# Added from worktree ${worktreeName}`,
    ...lines,
    "",
  ].join("\n");
  return { text: `${base}\n${block}`, added, existing };
}

/**
 * skip: same bytes.
 * copy: missing on develop, or the worktree file is newer.
 * keep-develop: develop is newer and the bytes differ.
 */
export function classifyAgentFile(input) {
  if (!input.developExists) return "copy";
  if (input.sameContent) return "skip";
  if (input.worktreeMtimeMs >= input.developMtimeMs) return "copy";
  return "keep-develop";
}

export function keptAgentName(fileName, worktreeName) {
  const ext = extname(fileName);
  const stem = ext ? fileName.slice(0, -ext.length) : fileName;
  return `${stem}.from-${worktreeName}${ext}`;
}

export function keepAgentFile(sourceRoot, src) {
  const rel = relative(sourceRoot, src).replaceAll("\\", "/");
  if (!rel) return true;
  const parts = rel.split("/");
  if (parts.includes(".run")) return false;
  const artifactAt = parts.indexOf("artifacts");
  if (artifactAt === -1) return true;
  const rest = parts.slice(artifactAt + 1);
  return rest.length === 0 || (rest.length === 1 && rest[0] === ".gitkeep");
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function refExists(ref) {
  try {
    execFileSync("git", ["show-ref", "--verify", "--quiet", ref], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function mainRootFrom(cwd) {
  const mainLine = git(["worktree", "list", "--porcelain"], cwd)
    .split(/\r?\n/)
    .find((line) => line.startsWith("worktree "));
  if (!mainLine) {
    console.error("Could not locate the main worktree.");
    process.exit(1);
  }
  return mainLine.slice("worktree ".length);
}

function assertName(name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    console.error(
      `Invalid name "${name}". Use letters, numbers, dots, underscores, and hyphens.`,
    );
    process.exit(1);
  }
}

function worktreeDir(mainRoot, name) {
  const dirName = name.startsWith("lightkeepers-")
    ? name
    : `lightkeepers-${name}`;
  return join(dirname(mainRoot), dirName);
}

function agentSource(cwd, mainRoot, rel) {
  const local = join(cwd, rel);
  if (existsSync(local)) return local;
  const main = join(mainRoot, rel);
  return existsSync(main) ? main : null;
}

function parseWorktrees(porcelain) {
  const entries = [];
  let current = null;
  for (const line of porcelain.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length), branch: null };
      continue;
    }
    if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    }
  }
  if (current) entries.push(current);
  return entries;
}

function filesUnder(top, dir = top) {
  if (!existsSync(dir)) return [];
  const stat = statSync(dir);
  if (!stat.isDirectory()) return [dir];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (!keepAgentFile(top, abs)) continue;
    if (entry.isDirectory()) out.push(...filesUnder(top, abs));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function sameBytes(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  const left = readFileSync(a);
  const right = readFileSync(b);
  return left.equals(right);
}

function syncAgents(workRoot, mainRoot, name) {
  const copied = [];
  const kept = [];
  for (const rel of agentPaths) {
    const sourceRoot = join(workRoot, rel);
    if (!existsSync(sourceRoot)) continue;
    for (const src of filesUnder(sourceRoot)) {
      const relFile = relative(sourceRoot, src);
      const dest = relFile ? join(mainRoot, rel, relFile) : join(mainRoot, rel);
      const developExists = existsSync(dest);
      const action = classifyAgentFile({
        developExists,
        sameContent: developExists && sameBytes(src, dest),
        worktreeMtimeMs: statSync(src).mtimeMs,
        developMtimeMs: developExists ? statSync(dest).mtimeMs : 0,
      });
      const shown = (relFile ? join(rel, relFile) : rel).replaceAll("\\", "/");
      if (action === "skip") continue;
      if (action === "copy") {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
        copied.push(shown);
        continue;
      }
      const backup = join(
        dirname(dest),
        keptAgentName(basename(relFile || rel), name),
      );
      mkdirSync(dirname(backup), { recursive: true });
      copyFileSync(src, backup);
      kept.push({
        develop: shown,
        backup: relative(mainRoot, backup).replaceAll("\\", "/"),
      });
    }
  }
  return { copied, kept };
}

function syncEnv(workRoot, mainRoot, name) {
  const from = join(workRoot, ".env");
  const to = join(mainRoot, ".env");
  if (!existsSync(from)) {
    console.log("No .env in the worktree");
    return;
  }
  if (!existsSync(to)) {
    copyFileSync(from, to);
    console.log("Copied .env onto the main worktree");
    return;
  }
  const merged = mergeEnvText(
    readFileSync(to, "utf8"),
    readFileSync(from, "utf8"),
    name,
  );
  if (merged.added.length > 0) {
    writeFileSync(to, merged.text);
    console.log(`Added env ${merged.added.join(", ")}`);
  } else {
    console.log("No new env keys");
  }
}

function createWorktree(name) {
  assertName(name);
  const mainRoot = mainRootFrom(process.cwd());
  const dest = worktreeDir(mainRoot, name);

  if (existsSync(dest)) {
    console.error(`Path already exists: ${dest}`);
    process.exit(1);
  }

  if (refExists(`refs/heads/${name}`)) {
    console.error(`Branch already exists: ${name}`);
    process.exit(1);
  }

  if (!refExists("refs/heads/develop")) {
    console.error("Local branch develop was not found.");
    process.exit(1);
  }

  const envSource = [join(process.cwd(), ".env"), join(mainRoot, ".env")].find(
    (file) => existsSync(file),
  );

  if (!envSource) {
    console.error("No .env in this checkout or the main worktree.");
    process.exit(1);
  }

  execFileSync("git", ["worktree", "add", "-b", name, dest, "develop"], {
    stdio: "inherit",
  });

  copyFileSync(envSource, join(dest, ".env"));

  const copied = [];
  const missing = [];
  for (const rel of agentPaths) {
    const source = agentSource(process.cwd(), mainRoot, rel);
    if (!source) {
      missing.push(rel);
      continue;
    }
    cpSync(source, join(dest, rel), {
      recursive: true,
      filter: (src) => keepAgentFile(source, src),
    });
    copied.push(rel);
  }

  console.log(`Branch ${name} from develop`);
  console.log("Copied .env");
  if (copied.length) console.log(`Copied ${copied.join(", ")}`);
  if (missing.length) console.log(`No ${missing.join(", ")} to copy`);
  console.log(dest);
}

function removeWorktree(name) {
  assertName(name);
  const cwd = process.cwd();
  const mainRoot = mainRootFrom(cwd);
  const entries = parseWorktrees(git(["worktree", "list", "--porcelain"], cwd));
  const branch = `refs/heads/${name}`;
  const registered = entries.find((entry) => entry.branch === branch);
  const dest = registered?.path ?? worktreeDir(mainRoot, name);

  if (!existsSync(dest)) {
    console.error(`No worktree at ${dest}`);
    process.exit(1);
  }

  if (isInside(dest, cwd)) {
    console.error(
      `Run this from the main checkout. ${dest} is the current tree.`,
    );
    process.exit(1);
  }

  if (dest === mainRoot) {
    console.error("Refusing to remove the main worktree.");
    process.exit(1);
  }

  syncEnv(dest, mainRoot, name);
  const agents = syncAgents(dest, mainRoot, name);
  if (agents.copied.length) {
    console.log(`Brought back ${agents.copied.join(", ")}`);
  } else {
    console.log("No newer agent files to bring back");
  }
  for (const item of agents.kept) {
    console.log(
      `Kept newer ${item.develop} on develop; worktree copy saved as ${item.backup}`,
    );
  }

  try {
    execFileSync("git", ["-C", mainRoot, "worktree", "remove", dest], {
      stdio: "inherit",
    });
  } catch {
    console.error(
      "Worktree was not removed. Commit or stash its tracked changes, then run remove again. Env keys and agent files already brought back stay on develop.",
    );
    process.exit(1);
  }
  console.log(`Removed ${dest}`);
  console.log(`Branch ${name} still exists`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.error(USAGE);
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args[0] === "remove") {
    const name = args[1];
    if (!name || args.length > 2) {
      console.error(USAGE);
      process.exit(1);
    }
    removeWorktree(name);
    return;
  }

  if (args.length !== 1) {
    console.error(USAGE);
    process.exit(1);
  }
  createWorktree(args[0]);
}

const invokedDirectly =
  process.argv[1] &&
  realpathSync(process.argv[1]) ===
    realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) main();
