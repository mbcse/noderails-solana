#!/bin/sh
set -eu
SP="${SIGNER_HOST_PORT:-8081}"
j=0
# ~60s max wait (240 * 0.25s) — fail fast if signer never binds (misconfig / missing Privy keys)
while [ "$j" -lt 240 ]; do
  if curl -sf "http://127.0.0.1:${SP}/healthz" >/dev/null 2>&1; then
    _api_heap="${NODE_HEAP_MB_API:-192}"
    exec node --max-old-space-size="${_api_heap}" services/api/dist/index.js
  fi
  j=$((j + 1))
  sleep 0.25
done
echo "[backend-stack] signer never became healthy on :${SP}; check KEY_PROVIDER / Privy env." >&2
exit 1
