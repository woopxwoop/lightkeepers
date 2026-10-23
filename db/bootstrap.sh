#!/usr/bin/env bash
# Install prod and staging Postgres onto this database server.
# Existing .env files and data volumes are left in place. A missing .env
# stops the run so a fresh machine is not started with an empty password.
set -euo pipefail

root=$(cd "$(dirname "$0")" && pwd)

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
  chmod 700 "$dest/init/02-roles.sh"

  docker compose -f "$dest/docker-compose.yml" --project-directory "$dest" up -d --wait
  docker exec -i "$name" bash -s < "$dest/init/02-roles.sh"
}

install_stack prod prod-postgres
install_stack staging staging-postgres
echo "database stacks up"
