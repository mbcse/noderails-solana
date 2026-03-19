#!/bin/sh
# Single container: signer-host (:8081 by default) + worker (Redis queue) + API (:9080).
# External Postgres + Redis via DATABASE_URL / REDIS_URL.
#
# Memory: three Node processes would each let the heap grow toward defaults and OOM small hosts
# (e.g. Render 512Mi). Caps are MiB old-space limits per process; raise on larger plans.
# Override: NODE_HEAP_MB_API, NODE_HEAP_MB_SIGNER, NODE_HEAP_MB_WORKER (integers).
set -eu

export SIGNER_HOST_URL="${SIGNER_HOST_URL:-http://127.0.0.1:8081}"

# Default caps tuned for ~512Mi–1Gi container RAM; increase if you see slow GC / heap errors.
export NODE_HEAP_MB_API="${NODE_HEAP_MB_API:-192}"
export NODE_HEAP_MB_SIGNER="${NODE_HEAP_MB_SIGNER:-64}"
export NODE_HEAP_MB_WORKER="${NODE_HEAP_MB_WORKER:-64}"

cd /app || exit 1

if [ "${PRISMA_MIGRATE_DEPLOY:-}" = "true" ]; then
  echo "[backend-stack] prisma migrate deploy"
  (cd packages/database && pnpm exec prisma migrate deploy)
fi

CC="./node_modules/.bin/concurrently"
if ! [ -x "$CC" ]; then
  echo "[backend-stack] missing concurrently (pnpm install)." >&2
  exit 1
fi

exec "$CC" -k \
  -n signer,worker,api \
  "node --max-old-space-size=${NODE_HEAP_MB_SIGNER} services/signer-host/dist/index.js" \
  "node --max-old-space-size=${NODE_HEAP_MB_WORKER} services/worker/dist/index.js" \
  "./docker/wait-signer-and-start-api.sh"
