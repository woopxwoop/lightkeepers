#!/usr/bin/env bash
# Restore the newest prod dump into a throwaway database and check that it
# has rows. The container and its anonymous data volume are removed on exit.
#
#   restore-check.sh install
#     Copies this file to /home/deploy/backups/restore-check.sh and reconciles
#     the weekly cron line. A later deploy replaces that line only when this
#     file or the schedule changed.
#
#   restore-check.sh
#     Runs the check. This is what cron runs.
set -euo pipefail
umask 077

dir=/home/deploy/backups
installed="$dir/restore-check.sh"
marker="lightkeepers-prod-restore-check"
schedule="17 5 * * 1"
container="lightkeepers-restore-check"

install_cron() {
  if ! pgrep -x cron >/dev/null && ! pgrep -x crond >/dev/null; then
    echo "cron is not running" >&2
    exit 1
  fi

  mkdir -p "$dir"
  cp "$0" "$installed.new"
  chmod 700 "$installed.new"
  mv "$installed.new" "$installed"

  hash=$(sha256sum "$installed" | awk '{print $1}')
  line="$schedule $installed >> $dir/restore-check.log 2>&1 # $marker $hash"

  current=$(crontab -l 2>/dev/null || true)
  kept=""
  previous=""
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    if [[ "$row" == *"$marker"* ]]; then
      previous="$row"
    else
      kept+="$row"$'\n'
    fi
  done <<< "$current"

  if [[ "$previous" == "$line" ]]; then
    echo "restore-check cron unchanged"
    return
  fi

  printf '%s%s\n' "$kept" "$line" | crontab -
  if [[ -n "$previous" ]]; then
    echo "restore-check cron replaced"
  else
    echo "restore-check cron installed"
  fi
}

if [[ "${1:-}" == "install" ]]; then
  install_cron
  exit 0
fi

# backup.sh deletes the file it was writing when pg_dump fails, and that name
# sorts newest. Hold the lock first so the dump we pick has already finished.
mkdir -p "$dir"
exec 9>"$dir/backup.lock"
if ! flock -w 7200 9; then
  echo "backup lock held" >&2
  exit 1
fi

shopt -s nullglob
dumps=("$dir"/lightkeepers-prod-*.dump)
if ((${#dumps[@]} == 0)); then
  echo "no prod dump to restore" >&2
  exit 1
fi
dump=$(printf '%s\n' "${dumps[@]}" | LC_ALL=C sort | tail -n 1)

# Nightly backup is cron 04:07. The newest name can still be an older file
# when that night's dump failed and was deleted.
expect=$(date -d '04:07' +%s)
if (( $(date +%s) < expect )); then
  expect=$(date -d 'yesterday 04:07' +%s)
fi
if (( $(stat -c %Y "$dump") < expect )); then
  echo "dump is older than the nightly backup at 04:07: $(basename "$dump")" >&2
  exit 1
fi

cleanup() {
  # -v removes the anonymous volume the postgres image keeps its data files in.
  docker rm -fv "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker rm -fv "$container" >/dev/null 2>&1 || true

docker run -d --name "$container" --network none \
  -e POSTGRES_USER=lightkeepers \
  -e POSTGRES_PASSWORD=restore-check \
  -e POSTGRES_DB=lightkeepers \
  postgres:15.8 >/dev/null

ready=""
for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready -U lightkeepers -d lightkeepers >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ -z "$ready" ]]; then
  echo "restore database did not start" >&2
  exit 1
fi

docker exec -i "$container" psql -U lightkeepers -d lightkeepers -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'CREATE ROLE anon NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
\gexec
SELECT 'CREATE ROLE authenticated NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
\gexec
SELECT 'CREATE ROLE service_role NOLOGIN BYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
\gexec
SELECT 'CREATE ROLE postgres NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
\gexec
SELECT 'CREATE ROLE authenticator NOINHERIT LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
\gexec
SQL

docker exec -i "$container" pg_restore --exit-on-error -U lightkeepers -d lightkeepers < "$dump"

users=$(docker exec "$container" psql -U lightkeepers -d lightkeepers -Atc "SELECT count(*) FROM public.\"user\"")
versions=$(docker exec "$container" psql -U lightkeepers -d lightkeepers -Atc "SELECT count(*) FROM public.abyss_versions")
if [[ "$users" -lt 1 || "$versions" -lt 1 ]]; then
  echo "restore check failed user=$users abyss_versions=$versions dump=$(basename "$dump")" >&2
  exit 1
fi

echo "restore check ok user=$users abyss_versions=$versions dump=$(basename "$dump")"
