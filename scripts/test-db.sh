#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the migration and runs tests/db/*.sql.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
if [ "$(id -u)" = "0" ]; then RUN="runuser -u postgres --"; chown -R postgres "$DATA"; else RUN=""; fi
$RUN "$PGBIN/initdb" -D "$DATA" -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/log" start -w >/dev/null
PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create database lf_test"
$PSQL -d lf_test -f "$ROOT/scripts/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -d lf_test -f "$f"; done
for f in "$ROOT"/tests/db/*.sql; do echo "== $(basename "$f")"; $PSQL -d lf_test -f "$f"; done
echo "DB tests passed"
