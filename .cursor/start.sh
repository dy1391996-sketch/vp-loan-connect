#!/usr/bin/env bash
# Per-boot startup for VP Loan Connect Cloud Agent environments.
# Starts the local PostgreSQL cluster and reconciles migrations. Idempotent.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

PG_VERSION=16
PG_BIN="/usr/lib/postgresql/${PG_VERSION}/bin"
export PGDATA="${PGDATA:-/home/ubuntu/pgdata}"
PG_PORT=5432
PG_LOG="/home/ubuntu/pg.log"

echo "==> Starting PostgreSQL"
if "${PG_BIN}/pg_ctl" -D "${PGDATA}" status >/dev/null 2>&1; then
  echo "PostgreSQL already running"
else
  "${PG_BIN}/pg_ctl" -D "${PGDATA}" -l "${PG_LOG}" \
    -o "-c listen_addresses='127.0.0.1' -p ${PG_PORT} -k /tmp" -w start
fi

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if "${PG_BIN}/pg_isready" -h 127.0.0.1 -p "${PG_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [ -f "${REPO_DIR}/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${REPO_DIR}/.env.local"
  set +a
  echo "==> Reconciling database migrations"
  pnpm db:deploy || echo "migrate deploy skipped/failed (non-fatal for boot)"
fi

echo "==> Startup complete"
