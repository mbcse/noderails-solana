#!/usr/bin/env bash
# Download IDL JSON for a deployed program (reads on-chain metadata Anchor stores).
#
# Usage:
#   ./scripts/idl-fetch.sh <PROGRAM_PUBKEY> [output.json]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER="${CLUSTER:-devnet}"
PROGRAM_ID="${1:?Usage: $0 <PROGRAM_PUBKEY> [output.json]}"
OUT="${2:-$ROOT/target/idl/fetched-${PROGRAM_ID:0:8}.json}"

cd "$ROOT"
mkdir -p "$(dirname "$OUT")"
anchor idl fetch "$PROGRAM_ID" --provider.cluster "$CLUSTER" -o "$OUT"
echo "Wrote $OUT"
