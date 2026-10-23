#!/usr/bin/env bash
# Nightly dump of prod Postgres, uploaded to the R2 bucket lightkeepers-db-backup.
#
#   backup.sh install
#     Copies this file to /home/deploy/backups/backup.sh and reconciles the
#     deploy user's crontab. The cron line carries a hash of this file, so a
#     later deploy removes the previous line and installs the new one only
#     when the script or the schedule changed.
#
#   backup.sh
#     Takes the dump. This is what cron runs.
#
# rclone.conf is created once on the database server and is not in git.
set -euo pipefail
umask 077

dir=/home/deploy/backups
conf="$dir/rclone.conf"
installed="$dir/backup.sh"
rclone="${RCLONE:-$HOME/bin/rclone}"
remote="r2:lightkeepers-db-backup/prod-postgres"
marker="lightkeepers-prod-backup"
schedule="7 4 * * *"

ensure_rclone() {
  if [[ -x "$rclone" ]]; then
    return
  fi
  mkdir -p "$HOME/bin"
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/rclone.zip" https://downloads.rclone.org/rclone-current-linux-amd64.zip
  python3 - "$tmp" "$HOME/bin/rclone" <<'PY'
import stat, sys, zipfile
from pathlib import Path
tmp = Path(sys.argv[1])
target = Path(sys.argv[2])
with zipfile.ZipFile(tmp / "rclone.zip") as archive:
    archive.extractall(tmp / "extract")
bins = list((tmp / "extract").glob("rclone-*/rclone"))
if len(bins) != 1:
    raise SystemExit("rclone binary not found")
target.write_bytes(bins[0].read_bytes())
target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
PY
  rm -rf "$tmp"
  rclone="$HOME/bin/rclone"
}

install_cron() {
  if [[ ! -f "$conf" ]]; then
    echo "rclone config is missing at $conf" >&2
    exit 1
  fi
  if ! pgrep -x cron >/dev/null && ! pgrep -x crond >/dev/null; then
    echo "cron is not running" >&2
    exit 1
  fi

  mkdir -p "$dir"
  cp "$0" "$installed.new"
  chmod 700 "$installed.new"
  mv "$installed.new" "$installed"

  hash=$(sha256sum "$installed" | awk '{print $1}')
  line="$schedule $installed >> $dir/backup.log 2>&1 # $marker $hash"

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
    echo "backup cron unchanged"
    return
  fi

  printf '%s%s\n' "$kept" "$line" | crontab -
  if [[ -n "$previous" ]]; then
    echo "backup cron replaced"
  else
    echo "backup cron installed"
  fi
}

if [[ "${1:-}" == "install" ]]; then
  ensure_rclone
  install_cron
  exit 0
fi

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
out="$dir/lightkeepers-prod-${stamp}.dump"

mkdir -p "$dir"
exec 9>"$dir/backup.lock"
if ! flock -n 9; then
  echo "backup already running" >&2
  exit 1
fi

if [[ ! -x "$rclone" ]]; then
  echo "rclone is missing at $rclone" >&2
  exit 1
fi
if [[ ! -f "$conf" ]]; then
  echo "rclone config is missing at $conf" >&2
  exit 1
fi

# pg_dump holds backup.lock until this process exits. A deadline kills a hung
# dump so the lock closes and the next cron run can take it.
if ! timeout --kill-after=30s 2h docker exec prod-postgres pg_dump -U lightkeepers -d lightkeepers -Fc > "$out"; then
  rm -f "$out"
  echo "pg_dump failed or timed out" >&2
  exit 1
fi
chmod 600 "$out"
# Read the whole custom-format archive, not only its table of contents.
docker exec -i prod-postgres pg_restore --exit-on-error -f /dev/null < "$out"

find "$dir" -name 'lightkeepers-prod-*.dump' -mtime +7 -delete

"$rclone" --config "$conf" copy "$out" "$remote/"
"$rclone" --config "$conf" delete --min-age 14d "$remote/"

bytes=$(wc -c < "$out")
echo "backup ok ${stamp} ${bytes}"
