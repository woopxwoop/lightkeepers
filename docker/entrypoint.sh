#!/bin/sh
set -e

IMMUTABLE_DIR="${IMMUTABLE_ASSETS_DIR:-/data/immutable}"
BUNDLED_IMMUTABLE="/app/build/client/_app/immutable"
RETENTION_HOURS="${IMMUTABLE_RETENTION_HOURS:-48}"

mkdir -p "$IMMUTABLE_DIR"

if [ -d "$BUNDLED_IMMUTABLE" ]; then
  # Merge new content-hashed chunks into the persistent volume without removing older hashes.
  cp -an "$BUNDLED_IMMUTABLE"/. "$IMMUTABLE_DIR"/ 2>/dev/null || {
  cp -a "$BUNDLED_IMMUTABLE"/. "$IMMUTABLE_DIR"/
  }
fi

# Drop chunks from builds older than the retention window.
find "$IMMUTABLE_DIR" -type f -mmin +$((RETENTION_HOURS * 60)) -delete 2>/dev/null || true

rm -rf "$BUNDLED_IMMUTABLE"
mkdir -p "$(dirname "$BUNDLED_IMMUTABLE")"
ln -sfn "$IMMUTABLE_DIR" "$BUNDLED_IMMUTABLE"

exec node build
