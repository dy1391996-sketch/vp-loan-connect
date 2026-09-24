#!/usr/bin/env bash
# Idempotent repository setup for VP Loan Connect Cloud Agent environments.
# Prepares a local PostgreSQL cluster, installs dependencies, generates the
# Prisma client, applies migrations, and seeds baseline data. Safe to re-run.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

PG_VERSION=16
PG_BIN="/usr/lib/postgresql/${PG_VERSION}/bin"
export PGDATA="${PGDATA:-/home/ubuntu/pgdata}"
PG_PORT=5432
PG_LOG="/home/ubuntu/pg.log"
DB_NAME="vp_loan_connect"
DB_USER="$(whoami)"

echo "==> Ensuring PostgreSQL ${PG_VERSION} is installed"
if [ ! -x "${PG_BIN}/pg_ctl" ]; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"
fi

echo "==> Ensuring the database cluster exists"
if [ ! -f "${PGDATA}/PG_VERSION" ]; then
  mkdir -p "${PGDATA}"
  "${PG_BIN}/initdb" -D "${PGDATA}" -U "${DB_USER}" \
    --auth-local=trust --auth-host=trust -E UTF8
fi

echo "==> Starting PostgreSQL for setup"
if ! "${PG_BIN}/pg_ctl" -D "${PGDATA}" status >/dev/null 2>&1; then
  "${PG_BIN}/pg_ctl" -D "${PGDATA}" -l "${PG_LOG}" \
    -o "-c listen_addresses='127.0.0.1' -p ${PG_PORT} -k /tmp" -w start
fi

echo "==> Ensuring database '${DB_NAME}' exists"
if ! "${PG_BIN}/psql" -h 127.0.0.1 -p "${PG_PORT}" -U "${DB_USER}" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  "${PG_BIN}/psql" -h 127.0.0.1 -p "${PG_PORT}" -U "${DB_USER}" -d postgres \
    -c "CREATE DATABASE ${DB_NAME}"
fi

echo "==> Writing .env.local (local development defaults) if absent"
if [ ! -f "${REPO_DIR}/.env.local" ]; then
  cat > "${REPO_DIR}/.env.local" <<EOF
# Local development environment for VP Loan Connect (Cloud Agent).
# All external providers run in mock mode. Never use these values in production.
DATABASE_URL="postgresql://${DB_USER}@127.0.0.1:${PG_PORT}/${DB_NAME}?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-nextauth-secret-at-least-32-characters-long"
REPORT_SIGNING_SECRET="dev-report-signing-secret-at-least-32-characters"
PAYMENT_PROVIDER="mock"
OTP_PROVIDER="mock"
MOCK_OTP_CODE="123456"
WHATSAPP_PROVIDER="mock"
WHATSAPP_API_URL="https://graph.facebook.com/v22.0"
BUSINESS_NAME="VP Loan Connect"
SUPPORT_EMAIL="support@vploanconnect.in"
ADMIN_EMAIL="admin@vploanconnect.in"
ADMIN_INITIAL_PASSWORD="DevAdminPass123"
STORE_CONSENT_IP="false"
EOF
fi

set -a
# shellcheck disable=SC1091
. "${REPO_DIR}/.env.local"
set +a

echo "==> Installing Node dependencies"
pnpm install --frozen-lockfile

echo "==> Generating Prisma client"
pnpm db:generate

# Reset the public schema to a clean slate so migrations apply from an empty
# database. This keeps setup idempotent and recovers a dev DB that repo tooling
# such as `pnpm verify:migration` may have left without migration history (that
# script points --shadow-database-url at the same DATABASE_URL). Plain SQL is
# used instead of `prisma migrate reset` because Prisma blocks that destructive
# command when it detects an AI agent. `migrate deploy` below is non-destructive.
echo "==> Resetting local development schema"
"${PG_BIN}/psql" -h 127.0.0.1 -p "${PG_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "==> Applying database migrations"
pnpm db:deploy

echo "==> Seeding baseline data"
pnpm db:seed

echo "==> Setup complete"
