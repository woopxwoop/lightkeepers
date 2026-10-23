#!/usr/bin/env bash
# Apply migrations/*.sql that this database has not recorded.
# Each file runs in its own transaction. Files must not contain BEGIN/COMMIT.
# Filenames are NNNN_words.sql. A filename already recorded in schema_migrations
# and missing from this directory fails the run.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

dir=$(cd "$(dirname "$0")" && pwd)
shopt -s nullglob
files=("$dir"/*.sql)

declare -a names=()
for f in "${files[@]}"; do
  base=$(basename "$f")
  if [[ ! "$base" =~ ^[0-9]{4}_[a-z0-9_]+\.sql$ ]]; then
    echo "migration filename must match NNNN_words.sql: $base" >&2
    exit 1
  fi
  names+=("$base")
done

declare -a sorted=()
if ((${#names[@]} > 0)); then
  # Assignment, not process substitution: mapfile would hide a sort failure
  # from set -e, and the script would report success.
  sorted_text=$(printf '%s\n' "${names[@]}" | LC_ALL=C sort)
  mapfile -t sorted <<< "$sorted_text"
fi

driver=$(mktemp)
trap 'rm -f "$driver"' EXIT

{
  echo "SELECT pg_advisory_lock(748291735);"
  echo "CREATE TABLE IF NOT EXISTS schema_migrations ("
  echo "  filename text PRIMARY KEY,"
  echo "  applied_at timestamptz NOT NULL DEFAULT now()"
  echo ");"
  echo "CREATE TEMP TABLE expected (filename text PRIMARY KEY);"
  for name in "${sorted[@]}"; do
    echo "INSERT INTO expected (filename) VALUES ('${name}');"
  done
  cat <<'SQL'
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(m.filename, ', ' ORDER BY m.filename)
    INTO missing
  FROM schema_migrations m
  WHERE NOT EXISTS (
    SELECT 1 FROM expected e WHERE e.filename = m.filename
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'applied migration missing from branch: %', missing;
  END IF;
END $$;
SQL
  for name in "${sorted[@]}"; do
    include="${dir}/${name}"
    include=${include//\\/\\\\}
    include=${include//\'/\\\'}
    cat <<SQL
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM schema_migrations WHERE filename = '${name}'
) THEN 0 ELSE 1 END AS should_apply \\gset
\\if :should_apply
\\echo applying ${name}
BEGIN;
\\i '${include}'
INSERT INTO schema_migrations (filename) VALUES ('${name}');
COMMIT;
\\endif
SQL
  done
} > "$driver"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$driver"
echo "migrations applied"
