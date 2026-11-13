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
 * Local-only paths ("carried" paths) are listed once, in .gitignore, between
 * `# worktree:carry` and `# worktree:end`. Ignoring a path there is also what
 * registers it for carrying.
 *
 * pnpm worktree <name>
 *   New branch from develop at ../lightkeepers-<name>.
 *   Copies .env and every carried path.
 *
 * pnpm worktree remove <name>
 *   Copies carried paths back onto the main worktree (using the union of
 *   develop's and the worktree's carry blocks, so a path the branch just
 *   started ignoring still comes back), appends .env keys that develop does
 *   not have yet, then removes the worktree. The branch stays. A newer file on
 *   develop is left in place; the worktree copy is kept beside it as
 *   <name>.from-<worktree>. Other ignored files are listed before removal.
 *
 * pnpm worktree prune [--yes]
 *   Lists local branches already merged into develop that are safe to delete,
 *   plus worktree entries whose folders are gone. Dry run by default; --yes
 *   runs `git worktree prune` and then `git branch -d` on each one, so git
 *   still refuses anything that turns out not to be merged.
 */

const CARRY_START = "# worktree:carry";
const CARRY_END = "# worktree:end";

/** Build/cache output that is never worth warning about on remove. */
const NOISE_SEGMENTS = new Set([
  "node_modules",
  ".svelte-kit",
  ".output",
  ".vercel",
  ".netlify",
  ".wrangler",
  "build",
  "cache",
  "test-results",
  "playwright-report",
  "blob-report",
  "__pycache__",
  ".pytest_cache",
]);

const USAGE = `Usage: pnpm worktree <name>
       pnpm worktree remove <name>
       pnpm worktree prune [--yes]

Creates ../lightkeepers-<name> on a new branch from develop and copies .env plus the paths in the "# worktree:carry" block of .gitignore.

remove folds those paths back into the main worktree first. New .env keys are appended. Existing keys are left as they are on develop. The branch is not deleted.

prune lists branches merged into develop and worktree entries whose folders are gone. Add --yes to delete them.`;

/** Branches prune never deletes, even when merged into develop. */
export const KEEP_BRANCHES = new Set(["develop", "main"]);

/**
 * Whether `pnpm worktree prune` deletes a branch that is already merged into
 * develop. `live` holds branch names checked out in a worktree whose folder
 * still exists — git refuses to delete those, and they are usually in use.
 */
export function shouldPruneBranch(branch, live) {
  if (KEEP_BRANCHES.has(branch) || live.has(branch)) {
    return false;
  }
  return true;
}

/**
 * Root-relative paths between the worktree:carry markers. Only plain paths
 * are accepted; globs, negations, and escapes land in `skipped`.
 */
export function carryPaths(gitignoreText) {
  const paths = [];
  const skipped = [];
  let inside = false;
  for (const raw of gitignoreText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!inside) {
      if (line.startsWith(CARRY_START)) inside = true;
      continue;
    }
    if (line.startsWith(CARRY_END)) break;
    if (!line || line.startsWith("#")) continue;
    const path = line.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!path || /[*?[\]!\\]/.test(line) || path.split("/").includes("..")) {
      skipped.push(line);
      continue;
    }
    if (!paths.includes(path)) paths.push(path);
  }
  return { paths, skipped };
}

export function unionPaths(...lists) {
  return [...new Set(lists.flat())];
}

/**
 * Entries from `git ls-files --others --ignored --directory` that are neither
 * carried nor build noise — files that would vanish with the worktree.
 */
export function uncarriedIgnored(ignored, carry) {
  return ignored.filter((entry) => {
    const path = entry.replace(/\/+$/, "");
    if (!path || path === ".env" || path.endsWith(".log")) return false;
    if (path.split("/").some((part) => NOISE_SEGMENTS.has(part))) return false;
    return !carry.some(
      (c) => path === c || path.startsWith(`${c}/`) || c.startsWith(`${path}/`),
    );
  });
}

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

export function parseWorktrees(porcelain) {
  const entries = [];
  let current = null;
  for (const line of porcelain.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = {
        path: line.slice("worktree ".length),
        branch: null,
        prunable: false,
      };
      continue;
    }
    if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    }
    if (current && (line === "prunable" || line.startsWith("prunable "))) {
      current.prunable = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}

/** Short names of branches checked out in a worktree whose folder exists. */
export function liveBranches(entries) {
  return new Set(
    entries
      .filter((entry) => entry.branch && !entry.prunable)
      .map((entry) => entry.branch.replace(/^refs\/heads\//, "")),
  );
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

function carryFrom(root) {
  const file = join(root, ".gitignore");
  if (!existsSync(file)) return { paths: [], skipped: [] };
  return carryPaths(readFileSync(file, "utf8"));
}

function warnSkipped(skipped) {
  for (const line of new Set(skipped)) {
    console.log(
      `Ignoring "${line}" in the worktree:carry block — use a plain path`,
    );
  }
}

function listIgnored(root) {
  try {
    return git(
      [
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard",
        "--directory",
      ],
      root,
    )
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function syncCarried(workRoot, mainRoot, name, carry) {
  const copied = [];
  const kept = [];
  for (const rel of carry) {
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

  const { paths: carry, skipped } = carryFrom(dest);
  warnSkipped(skipped);
  if (carry.length === 0) {
    console.log(
      "No # worktree:carry block in .gitignore; nothing else to copy",
    );
  }

  const copied = [];
  const missing = [];
  for (const rel of carry) {
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

  const fromDevelop = carryFrom(mainRoot);
  const fromWorktree = carryFrom(dest);
  warnSkipped([...fromDevelop.skipped, ...fromWorktree.skipped]);
  const carry = unionPaths(fromDevelop.paths, fromWorktree.paths);

  syncEnv(dest, mainRoot, name);
  const carried = syncCarried(dest, mainRoot, name, carry);
  if (carried.copied.length) {
    console.log(`Brought back ${carried.copied.join(", ")}`);
  } else {
    console.log("No newer carried files to bring back");
  }
  for (const item of carried.kept) {
    console.log(
      `Kept newer ${item.develop} on develop; worktree copy saved as ${item.backup}`,
    );
  }

  const left = uncarriedIgnored(listIgnored(dest), carry);
  if (left.length) {
    console.log(
      `Not carried (deleted with the worktree): ${left.join(", ")}. Add a path to the # worktree:carry block in .gitignore to keep it next time.`,
    );
  }

  try {
    execFileSync("git", ["-C", mainRoot, "worktree", "remove", dest], {
      stdio: "inherit",
    });
  } catch {
    console.error(
      "Worktree was not removed. Commit or stash its tracked changes, then run remove again. Env keys and carried files already brought back stay on develop.",
    );
    process.exit(1);
  }
  console.log(`Removed ${dest}`);
  console.log(`Branch ${name} still exists`);
}

function branchesAgainstDevelop(flag, root) {
  return git(
    [
      "for-each-ref",
      `${flag}=refs/heads/develop`,
      "--format=%(refname:lstrip=2)",
      "refs/heads/",
    ],
    root,
  )
    .split(/\r?\n/)
    .filter(Boolean);
}

function pruneBranches(apply) {
  const mainRoot = mainRootFrom(process.cwd());
  if (!refExists("refs/heads/develop")) {
    console.error("Local branch develop was not found.");
    process.exit(1);
  }

  const entries = parseWorktrees(
    git(["worktree", "list", "--porcelain"], mainRoot),
  );
  const stale = entries.filter((entry) => entry.prunable);
  const live = liveBranches(entries);
  const merged = branchesAgainstDevelop("--merged", mainRoot);
  const unmerged = branchesAgainstDevelop("--no-merged", mainRoot);
  const targets = merged.filter((branch) => shouldPruneBranch(branch, live));
  const kept = merged.filter((branch) => !targets.includes(branch));

  if (stale.length) {
    console.log(
      `Worktree entries with no folder: ${stale.map((e) => e.path).join(", ")}`,
    );
  }
  if (kept.length) console.log(`Merged but kept: ${kept.join(", ")}`);
  if (unmerged.length) console.log(`Not merged: ${unmerged.join(", ")}`);
  if (targets.length === 0 && stale.length === 0) {
    console.log("Nothing to prune");
    return;
  }
  if (targets.length) console.log(`Merged into develop: ${targets.join(", ")}`);

  if (!apply) {
    console.log("Dry run. Run pnpm worktree prune --yes to delete these.");
    return;
  }

  if (stale.length) {
    git(["worktree", "prune"], mainRoot);
    console.log(`Pruned ${stale.length} worktree entries`);
  }

  const deleted = [];
  const refused = [];
  for (const branch of targets) {
    try {
      git(["branch", "-d", "--", branch], mainRoot);
      deleted.push(branch);
    } catch (error) {
      refused.push(`${branch} (${String(error.stderr ?? "").trim()})`);
    }
  }
  if (deleted.length) console.log(`Deleted ${deleted.join(", ")}`);
  for (const item of refused) console.log(`Git kept ${item}`);
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

  if (args[0] === "prune") {
    const rest = args.slice(1);
    if (rest.some((arg) => arg !== "--yes")) {
      console.error(USAGE);
      process.exit(1);
    }
    pruneBranches(rest.includes("--yes"));
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
