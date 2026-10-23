#!/bin/bash
# PostgREST roles for a new data directory. Idempotent: an existing database
# can run it again. The authenticator password is read from the container env
# and is only used when that role does not exist yet.
set -euo pipefail

authenticator_exists=$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = 'authenticator'")
if [[ "$authenticator_exists" != "1" && -z "${AUTHENTICATOR_PASSWORD:-}" ]]; then
  echo "AUTHENTICATOR_PASSWORD is required to create authenticator" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v authenticator_password="${AUTHENTICATOR_PASSWORD:-}" <<'SQL'
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
SELECT format('CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD %L', :'authenticator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
\gexec
GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE lightkeepers IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE lightkeepers IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE lightkeepers IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQL
