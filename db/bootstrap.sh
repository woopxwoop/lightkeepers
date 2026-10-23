#!/usr/bin/env bash
# Install prod and staging Postgres onto this database server.
# Existing .env files and data volumes are left in place. A missing .env
# stops the run so a fresh machine is not started with an empty password.
set -euo pipefail

root=$(cd "$(dirname "$0")" && pwd)

# PostgREST reads a URI. The role password is the literal .env value, so
# the generated env file percent-encodes it. Otherwise "/", "#", and "%"
# are read as part of the URI and the role password no longer matches.
write_postgrest_env() {
  local dest="$1"
  python3 - "$root/compose_env.py" "$dest" <<'PY'
import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("compose_env", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

dest = Path(sys.argv[2])
env = mod.load(dest / ".env")
uri = mod.postgres_uri(
    "authenticator",
    env.get("AUTHENTICATOR_PASSWORD", ""),
    "postgres",
    "5432",
    "lightkeepers",
)
tmp = dest / "postgrest.env.new"
tmp.write_text(f"PGRST_DB_URI={uri}\n")
tmp.chmod(0o600)
tmp.replace(dest / "postgrest.env")
PY
}

install_stack() {
  local source_dir="$1"
  local name="$2"
  local dest="$HOME/$name"

  if [[ ! -f "$dest/.env" ]]; then
    echo "$dest/.env is missing. Create it from db/env.example before starting $name." >&2
    exit 1
  fi

  mkdir -p "$dest/init"
  cp "$root/$source_dir/docker-compose.yml" "$dest/docker-compose.yml"
  cp "$root/$source_dir/nginx.conf" "$dest/nginx.conf"
  cp "$root/init/01-extensions.sql" "$root/init/02-roles.sh" "$dest/init/"
  # postgres in the container is not the host user that owns this mount.
  chmod 755 "$dest/init/02-roles.sh"
  write_postgrest_env "$dest"

  docker compose -f "$dest/docker-compose.yml" --project-directory "$dest" up -d --wait
  docker exec -i "$name" bash -s < "$dest/init/02-roles.sh"
}

install_stack prod prod-postgres
install_stack staging staging-postgres
echo "database stacks up"
