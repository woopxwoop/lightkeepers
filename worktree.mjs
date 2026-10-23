import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const name = process.argv[2];

if (!name || name === "-h" || name === "--help") {
  console.error("Usage: pnpm worktree <name>");
  console.error(
    "Creates ../lightkeepers-<name> on a new branch from develop and copies .env, AGENTS.md, CLAUDE.md, .cursor, and .claude.",
  );
  process.exit(name ? 0 : 1);
}

if (process.argv.length > 3) {
  console.error("Usage: pnpm worktree <name>");
  process.exit(1);
}

if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
  console.error(`Invalid name "${name}". Use letters, numbers, dots, underscores, and hyphens.`);
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, {
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

const mainLine = git(["worktree", "list", "--porcelain"])
  .split(/\r?\n/)
  .find((line) => line.startsWith("worktree "));

if (!mainLine) {
  console.error("Could not locate the main worktree.");
  process.exit(1);
}

const mainRoot = mainLine.slice("worktree ".length);
const dirName = name.startsWith("lightkeepers-") ? name : `lightkeepers-${name}`;
const dest = join(dirname(mainRoot), dirName);

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

const envSource = [join(process.cwd(), ".env"), join(mainRoot, ".env")].find((file) =>
  existsSync(file),
);

if (!envSource) {
  console.error("No .env in this checkout or the main worktree.");
  process.exit(1);
}

const agentPaths = ["AGENTS.md", "CLAUDE.md", ".cursor", ".claude"];

function agentSource(rel) {
  const local = join(process.cwd(), rel);
  if (existsSync(local)) return local;
  const main = join(mainRoot, rel);
  return existsSync(main) ? main : null;
}

function keepAgentFile(sourceRoot, src) {
  const rel = relative(sourceRoot, src).replaceAll("\\", "/");
  if (!rel) return true;
  const parts = rel.split("/");
  if (parts.includes(".run")) return false;
  const artifactAt = parts.indexOf("artifacts");
  if (artifactAt === -1) return true;
  const rest = parts.slice(artifactAt + 1);
  return rest.length === 0 || (rest.length === 1 && rest[0] === ".gitkeep");
}

execFileSync("git", ["worktree", "add", "-b", name, dest, "develop"], {
  stdio: "inherit",
});

copyFileSync(envSource, join(dest, ".env"));

const copied = [];
const missing = [];
for (const rel of agentPaths) {
  const source = agentSource(rel);
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
