#!/usr/bin/env bash
# Run migrations/migrate.sh on this host, which can reach the private database.
# DATABASE_URL is the only input. It is not printed.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

root=$(cd "$(dirname "$0")" && pwd)
umask 077
envfile=$(mktemp)
trap 'rm -f "$envfile"' EXIT
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > "$envfile"

docker run --rm --network host \
  --env-file "$envfile" \
  -v "$root:/work:ro" \
  -w /work \
  --entrypoint bash \
  postgres:15.8 \
  migrate.sh
