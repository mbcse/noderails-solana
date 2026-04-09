#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -d "$HOME/.local/share/solana/install/active_release/bin" ]]; then
  PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi
export PATH

for cmd in solana-test-validator solana-keygen anchor pnpm; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing required command: $cmd" >&2
    exit 1
  }
done

WALLET_JSON="${ROOT}/../solana/noderails/devnet-wallet.json"
[[ -f "$WALLET_JSON" ]] || {
  echo "missing wallet: $WALLET_JSON" >&2
  exit 1
}

anchor build

ESCROW_PK=$(solana-keygen pubkey "${ROOT}/target/deploy/noderails_escrow-keypair.json")
MM_PK=$(solana-keygen pubkey "${ROOT}/target/deploy/noderails_merchant_manager-keypair.json")
MINT_PK=$(solana-keygen pubkey "$WALLET_JSON")

LEDGER="${ROOT}/.anchor/test-ledger"
rm -rf "$LEDGER"

solana-test-validator \
  --reset \
  --quiet \
  --ledger "$LEDGER" \
  --bind-address 127.0.0.1 \
  --rpc-port 8899 \
  --mint "$MINT_PK" \
  --compute-unit-limit 12000000 \
  --bpf-program "$ESCROW_PK" "${ROOT}/target/deploy/noderails_escrow.so" \
  --bpf-program "$MM_PK" "${ROOT}/target/deploy/noderails_merchant_manager.so" &
V_PID=$!

cleanup() {
  kill "$V_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 100); do
  if solana cluster-version -u http://127.0.0.1:8899 >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET="$WALLET_JSON"

pnpm exec tsx ./node_modules/mocha/bin/mocha.js --timeout 1200000 tests/integration.test.ts "$@"
