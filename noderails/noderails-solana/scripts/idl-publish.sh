#!/usr/bin/env bash
# Create or update the on-chain IDL/metadata account for a program.
# Use when you deployed with --no-idl or changed the interface and need to refresh IDL.
#
# Usage:
#   ./scripts/idl-publish.sh noderails_escrow
#   ./scripts/idl-publish.sh noderails_merchant_manager
#
# Env: CLUSTER (default devnet), WALLET (defaults like deploy.sh)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
CLUSTER="${CLUSTER:-devnet}"
CRATE="${1:?Usage: $0 <noderails_escrow|noderails_merchant_manager>}"

if [[ -z "${WALLET:-}" ]]; then
  if [[ "$CLUSTER" == mainnet-beta ]] || [[ "$CLUSTER" == mainnet ]]; then
    WALLET="$REPO_ROOT/solana/noderails/mainnet-wallet.json"
  else
    WALLET="$REPO_ROOT/solana/noderails/devnet-wallet.json"
  fi
fi

KEYPAIR="$ROOT/target/deploy/${CRATE}-keypair.json"
IDL="$ROOT/target/idl/${CRATE}.json"

if [[ ! -f "$KEYPAIR" ]]; then
  echo "Missing $KEYPAIR — run 'anchor build' in noderails-solana first." >&2
  exit 1
fi
if [[ ! -f "$IDL" ]]; then
  echo "Missing $IDL — run 'anchor build' first." >&2
  exit 1
fi

PROGRAM_ID="$(solana-keygen pubkey "$KEYPAIR")"

cd "$ROOT"
set +e
anchor idl upgrade \
  --filepath "$IDL" \
  --provider.cluster "$CLUSTER" \
  --provider.wallet "$WALLET" \
  "$PROGRAM_ID" 2>/dev/null
UPGRADE_EXIT=$?
set -e

if [[ "$UPGRADE_EXIT" -ne 0 ]]; then
  echo "idl upgrade failed or no IDL yet — running idl init ..."
  anchor idl init \
    --filepath "$IDL" \
    --provider.cluster "$CLUSTER" \
    --provider.wallet "$WALLET" \
    "$PROGRAM_ID"
fi

echo "Published IDL for $CRATE at program $PROGRAM_ID on $CLUSTER"
