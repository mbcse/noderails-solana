#!/usr/bin/env bash
# Deploy all Anchor programs in this workspace.
#
# On-chain IDL: `anchor deploy` uploads program metadata (IDL) by default.
# Pass --no-idl if you want deployment without IDL (then use idl-publish.sh).
#
# Full automation (JSON + initialize): deploy.devnet.json / deploy.mainnet.json and run:
#   pnpm deploy:solana:devnet
#   pnpm deploy:solana:mainnet
#
# First-time program addresses (before keys exist in source + Anchor.toml):
#   1. anchor build
#   2. anchor keys sync devnet    # or: mainnet-beta / localnet
#   3. anchor build               # rebuild after declare_id! / Anchor.toml change
#   4. ./scripts/deploy.sh
#
# Env:
#   CLUSTER   default devnet  (examples: devnet, mainnet-beta, localnet)
#   WALLET    default repo solana/noderails/<cluster>-appropriate wallet — override path as needed
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
CLUSTER="${CLUSTER:-devnet}"

if [[ -z "${WALLET:-}" ]]; then
  if [[ "$CLUSTER" == mainnet-beta ]] || [[ "$CLUSTER" == mainnet ]]; then
    WALLET="$REPO_ROOT/solana/noderails/mainnet-wallet.json"
  else
    WALLET="$REPO_ROOT/solana/noderails/devnet-wallet.json"
  fi
fi

if [[ ! -f "$WALLET" ]]; then
  echo "Wallet not found: $WALLET (create keys under solana/noderails/ or set WALLET=)" >&2
  exit 1
fi

cd "$ROOT"
anchor build
anchor deploy --provider.cluster "$CLUSTER" --provider.wallet "$WALLET" "$@"

echo
echo "IDL on-chain (unless you passed --no-idl). Fetch examples:"
echo "  anchor idl fetch <PROGRAM_ID> --provider.cluster $CLUSTER -o escrow-idl.json"
echo "  anchor idl fetch <PROGRAM_ID> --provider.cluster $CLUSTER -o merchant-idl.json"
