import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { request } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const key = join(homedir(), ".ssh", "id_ed25519_deploy");
const host = "deploy@167.233.174.167";
const identity = existsSync(key) ? ["-i", key] : [];
const sshBase = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", ...identity, host];
const port = "18080";
const url = `http://127.0.0.1:${port}`;
const noTunnel = process.argv.includes("--no-tunnel");

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: input ? ["pipe", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
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

run("ssh", ["-n", ...sshBase, "mkdir -p ~/studio"]);
run("scp", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", ...identity, join(root, "studio", "docker-compose.yml"), `${host}:studio/docker-compose.yml`]);

const remote = String.raw`
set -euo pipefail
umask 077
python3 - << 'PY'
from pathlib import Path
import secrets

def load(path):
    env = {}
    for line in Path(path).read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1]
        env[key] = value
    return env

def quote(value):
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("$", "$$")
    return f'"{escaped}"'

def unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        value = value[1:-1]
    return value.replace("$$", "$").replace('\\"', '"').replace("\\\\", "\\")

prod = load("/home/deploy/prod-postgres/.env")
client = load("/home/deploy/prod-postgres/client.env")
target = Path("/home/deploy/studio/.env")
current = load(target) if target.exists() else {}
saved = current.get("PG_META_CRYPTO_KEY")
crypto = unquote(saved) if saved else secrets.token_hex(16)
values = {
    "POSTGRES_PASSWORD": prod["POSTGRES_PASSWORD"],
    "JWT_SECRET": prod["JWT_SECRET"],
    "PG_META_CRYPTO_KEY": crypto,
    "ANON_KEY": client["PUBLIC_SUPABASE_KEY"],
    "SERVICE_ROLE_KEY": client["PRIVATE_SUPABASE_KEY"],
}
target.write_text("".join(f"{key}={quote(value)}\n" for key, value in values.items()))
target.chmod(0o600)
print("studio env written")
PY
docker compose -f "$HOME/studio/docker-compose.yml" --project-directory "$HOME/studio" up -d
python3 - << 'PY'
import time
import urllib.request
for _ in range(40):
    try:
        with urllib.request.urlopen("http://127.0.0.1:18080", timeout=3) as response:
            print(f"studio_status={response.status}")
            raise SystemExit(0)
    except Exception as exc:
        code = getattr(exc, "code", None)
        if code and code < 500:
            print(f"studio_status={code}")
            raise SystemExit(0)
    time.sleep(2)
print("studio did not answer on 127.0.0.1:18080")
raise SystemExit(1)
PY
`;

run("ssh", [...sshBase, "bash", "-s"], remote);

const serve = spawnSync(
  "ssh",
  ["-n", ...sshBase, `tailscale serve --bg --tcp ${port} tcp://127.0.0.1:${port}`],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
if (serve.status === 0) {
  console.log(`http://100.69.255.83:${port}`);
  process.exit(0);
}

if (noTunnel) process.exit(0);

const tunnel = spawn(
  "ssh",
  ["-n", "-o", "ExitOnForwardFailure=yes", ...sshBase, "-N", "-L", `127.0.0.1:${port}:127.0.0.1:${port}`],
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
console.log(url);
