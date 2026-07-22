#!/bin/sh
set -e

DATABASE_URL="${DATABASE_URL:-file:/app/db/custom.db}"
export DATABASE_URL
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3001}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

DB_PATH="/app/db/custom.db"

if [ ! -f "$DB_PATH" ]; then
    cp /app/db-init/custom.db "$DB_PATH"
    echo "Database initialized from template"
fi

cd /app/next-service-dist
echo "Starting Next.js..."
exec node server.js
