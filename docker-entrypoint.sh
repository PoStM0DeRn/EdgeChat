#!/bin/sh
set -e

DATABASE_URL="${DATABASE_URL:-file:/app/db/custom.db}"
export DATABASE_URL
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

DB_PATH="/app/db/custom.db"

if [ ! -f "$DB_PATH" ]; then
    echo "Initializing database..."
    cd /app
    bunx prisma db push --accept-data-loss && echo "Database initialized" || echo "Warning: DB init failed, continuing..."
fi

cd /app/next-service-dist
echo "Starting Next.js..."
bun server.js &
NEXT_PID=$!

cd /app
echo "Starting Caddy..."
exec caddy run --config Caddyfile --adapter caddyfile
