import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { request } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// pnpm studio              → prod      (http://127.0.0.1:18080)
// pnpm studio --staging    → staging   (http://127.0.0.1:18081)
// pnpm studio --no-tunnel  → start/update Studio on the server only
//
// Each target gets its own folder, containers, and port on the database
// server, so both can run at once.
const TARGETS = {
  prod: {
    dir: "studio",
    port: "18080",
    name: "lightkeepers-studio",
    project: "Prod",
    stack: "prod-postgres",
    gateway: "http://prod-postgrest-gateway:3001",
  },
  staging: {
    dir: "studio-staging",
    port: "18081",
    name: "lightkeepers-studio-staging",
    project: "Staging",
    stack: "staging-postgres",
    gateway: "http://staging-postgrest-gateway:3000",
  },
};

const target = process.argv.includes("--staging")
  ? TARGETS.staging
  : TARGETS.prod;

const root = dirname(fileURLToPath(import.meta.url));
const key = join(homedir(), ".ssh", "id_ed25519_deploy");
const host = "deploy@167.233.174.167";
const identity = existsSync(key) ? ["-i", key] : [];
const sshBase = [
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=20",
  ...identity,
  host,
];
const port = target.port;
const url = `http://127.0.0.1:${port}`;
const noTunnel = process.argv.includes("--no-tunnel");

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: input
      ? ["pipe", "inherit", "inherit"]
      : ["ignore", "inherit", "inherit"],
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function pageIsUp() {
  return new Promise((resolve) => {
    const req = request(url, { timeout: 3000 }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

console.log(`Studio → ${target.project}`);

run("ssh", ["-n", ...sshBase, `mkdir -p ~/${target.dir}`]);
run("scp", [
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=20",
  ...identity,
  join(root, "studio", "docker-compose.yml"),
  `${host}:${target.dir}/docker-compose.yml`,
]);

// Same parser bootstrap uses, so a quoted .env password reaches Studio without the quotes.
const composeEnvPy = readFileSync(join(root, "db", "compose_env.py"), "utf8");
const remote =
  String.raw`
set -euo pipefail
umask 077
python3 - << 'PY'
` +
  composeEnvPy +
  String.raw`
import secrets

stack = "/home/deploy/${target.stack}"
db = load(f"{stack}/.env")
client = load(f"{stack}/client.env")
target = Path("/home/deploy/${target.dir}/.env")
current = load(target) if target.exists() else {}
saved = current.get("PG_META_CRYPTO_KEY")
crypto = saved if saved else secrets.token_hex(16)
values = {
    "STUDIO_PORT": "${target.port}",
    "STUDIO_NAME": "${target.name}",
    "STUDIO_PROJECT": "${target.project}",
    "DB_HOST": "${target.stack}",
    "DB_NETWORK": "${target.stack}_default",
    "GATEWAY_URL": "${target.gateway}",
    "POSTGRES_PASSWORD": db["POSTGRES_PASSWORD"],
    "JWT_SECRET": db["JWT_SECRET"],
    "PG_META_CRYPTO_KEY": crypto,
    "ANON_KEY": client["PUBLIC_SUPABASE_KEY"],
    "SERVICE_ROLE_KEY": client["PRIVATE_SUPABASE_KEY"],
}
target.write_text("".join(f"{key}={quote(value)}\n" for key, value in values.items()))
target.chmod(0o600)
print("studio env written")
PY
# Earlier versions published Studio on the tailnet with a persistent
# 'tailscale serve --bg'. Remove that forward if it is still there.
tailscale serve --tcp=${port} off >/dev/null 2>&1 || true
docker compose -f "$HOME/${target.dir}/docker-compose.yml" --project-directory "$HOME/${target.dir}" up -d
python3 - << 'PY'
import time
import urllib.request
for _ in range(40):
    try:
        with urllib.request.urlopen("http://127.0.0.1:${port}", timeout=3) as response:
            print(f"studio_status={response.status}")
            raise SystemExit(0)
    except Exception as exc:
        code = getattr(exc, "code", None)
        if code and code < 500:
            print(f"studio_status={code}")
            raise SystemExit(0)
    time.sleep(2)
print("studio did not answer on 127.0.0.1:${port}")
raise SystemExit(1)
PY
`;

run("ssh", [...sshBase, "bash", "-s"], remote);

// Studio has no login and holds superuser + service-role credentials, so it
// is reached only through this SSH tunnel: loopback on both ends, gone when
// this process exits. Never `tailscale serve` it — that publishes it to
// every tailnet device and persists across reboots.
if (noTunnel) process.exit(0);

const tunnel = spawn(
  "ssh",
  [
    "-n",
    "-o",
    "ExitOnForwardFailure=yes",
    ...sshBase,
    "-N",
    "-L",
    `127.0.0.1:${port}:127.0.0.1:${port}`,
  ],
  { stdio: ["ignore", "inherit", "inherit"] },
);
let opened = false;
tunnel.on("close", (code) => {
  if (!opened) console.error("SSH tunnel closed before Studio was reachable.");
  process.exit(code ?? (opened ? 0 : 1));
});

for (let attempt = 0; attempt < 30; attempt += 1) {
  if (await pageIsUp()) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!(await pageIsUp())) {
  tunnel.kill();
  console.error(`Could not open ${url}`);
  process.exit(1);
}
opened = true;
console.log(`${url}  (${target.project})`);
