#!/bin/bash
set -euo pipefail

# ============================================================================
# NodeRails Contract Deployment Script
# ============================================================================
#
# Usage:
#   ./script/deploy.sh <chainId> <target>
#
# Targets:
#   all               Deploy both Escrow + MerchantManager
#   escrow            Deploy only NodeRailsEscrow
#   merchant-manager  Deploy only NodeRailsMerchantManager
#
# Examples:
#   ./script/deploy.sh 11155111 all
#   ./script/deploy.sh 11155111 escrow
#   ./script/deploy.sh 84532 merchant-manager
#
# Required .env variables:
#   DEPLOYER_PRIVATE_KEY     Private key for deploying contracts
#   SUPER_ADMIN_ADDRESS      Address that gets SuperAdmin role
#   ADMIN_ADDRESSES          Comma-separated admin addresses assigned in constructors
#   FEE_RECIPIENT_ADDRESS    Address that receives platform fees (for escrow)
#   ETHERSCAN_API_KEY        Optional. Auto-verify after deploy if set
#   LEANRPC_API_KEY          RPC provider API key
#
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Args ---
CHAIN_ID="${1:-}"
TARGET="${2:-}"

if [[ -z "$CHAIN_ID" || -z "$TARGET" ]]; then
    echo "Usage: ./script/deploy.sh <chainId> <target>"
    echo ""
    echo "Targets:"
    echo "  all               Deploy Escrow + MerchantManager"
    echo "  escrow            Deploy NodeRailsEscrow only"
    echo "  merchant-manager  Deploy NodeRailsMerchantManager only"
    echo ""
    echo "Examples:"
    echo "  ./script/deploy.sh 11155111 all"
    echo "  ./script/deploy.sh 84532 escrow"
    exit 1
fi

# --- Load .env ---
if [[ -f .env ]]; then
    set -a
    source .env
    set +a
fi

# --- Resolve chain config ---
CHAINS_FILE="$SCRIPT_DIR/chains.json"

get_chain_field() {
    local field="$1"
    python3 -c "
import json, sys
with open('$CHAINS_FILE') as f:
    data = json.load(f)
for network_type in ['testnets', 'mainnets']:
    for name, chain in data.get(network_type, {}).items():
        if str(chain['chainId']) == '$CHAIN_ID':
            print(chain.get('$field', ''))
            sys.exit(0)
print('')
"
}

RPC_URL=$(get_chain_field "rpcUrl")
GAS_LIMIT=$(get_chain_field "gasLimit")
EXPLORER_URL=$(get_chain_field "explorerUrl")
CHAIN_NAME=$(python3 -c "
import json
with open('$CHAINS_FILE') as f:
    data = json.load(f)
for network_type in ['testnets', 'mainnets']:
    for name, chain in data.get(network_type, {}).items():
        if str(chain['chainId']) == '$CHAIN_ID':
            print(name)
            exit(0)
print('unknown')
")

if [[ -z "$RPC_URL" ]]; then
    echo "Error: Chain ID $CHAIN_ID not found in chains.json"
    exit 1
fi

# --- Map target to Solidity script ---
case "$TARGET" in
    all)
        SCRIPT_NAME="DeployAll"
        ;;
    escrow)
        SCRIPT_NAME="DeployEscrow"
        ;;
    merchant-manager)
        SCRIPT_NAME="DeployMerchantManager"
        ;;
    *)
        echo "Error: Unknown target '$TARGET'. Use: all, escrow, merchant-manager"
        exit 1
        ;;
esac

SCRIPT_PATH="script/solidity/${SCRIPT_NAME}.s.sol"

# --- Validate required env vars ---
: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is required}"
: "${SUPER_ADMIN_ADDRESS:?SUPER_ADMIN_ADDRESS is required}"
: "${ADMIN_ADDRESSES:?ADMIN_ADDRESSES is required}"

if [[ "$TARGET" == "all" || "$TARGET" == "escrow" ]]; then
    : "${FEE_RECIPIENT_ADDRESS:?FEE_RECIPIENT_ADDRESS is required for escrow deployment}"
fi

# --- Build ---
echo "============================================"
echo "  NodeRails Contract Deployment"
echo "============================================"
echo "  Chain:    $CHAIN_NAME ($CHAIN_ID)"
echo "  Target:   $TARGET ($SCRIPT_NAME)"
echo "  SuperAdmin: $SUPER_ADMIN_ADDRESS"
echo "  Admins:     $ADMIN_ADDRESSES"
echo "============================================"
echo ""

echo "Building contracts..."
forge build
echo ""

# --- Deploy ---
echo "Deploying $SCRIPT_NAME on $CHAIN_NAME (chain $CHAIN_ID)..."
echo ""

# For Filecoin, we need to skip simulation and rely on RPC gas estimation
SKIP_SIM_FLAG=""
if [[ "$CHAIN_ID" == "314159" ]]; then
    SKIP_SIM_FLAG="--skip-simulation"
fi

# Deploy without verification first (verification happens as separate step after save)
ETHERSCAN_API_KEY= \
forge script $SKIP_SIM_FLAG "$SCRIPT_PATH:$SCRIPT_NAME" \
    --rpc-url "$RPC_URL" \
    --broadcast \
    -vvvv

echo ""

# --- Save deploy data ---
echo "Saving deployment data..."
python3 script/save-deploy-data.py "$CHAIN_ID" "$SCRIPT_NAME"

echo ""

# --- Verify (best effort, does not block saved deployment metadata) ---
SHOULD_VERIFY="false"
if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
    # Only verify if we have an API key
    SHOULD_VERIFY="true"
fi

if [[ "$SHOULD_VERIFY" == "true" ]]; then
    VERIFY_BACKEND=""
    VERIFY_API_URL=""

    # Blockscout-based chains
    if [[ "$EXPLORER_URL" == *"blockscout"* ]]; then
        VERIFY_BACKEND="blockscout"
        VERIFY_API_URL="${EXPLORER_URL%/}/api"
    elif [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
        # Etherscan-compatible path
        VERIFY_BACKEND="etherscan"
    fi

    if [[ -n "$VERIFY_BACKEND" ]]; then
        echo "Starting verification (best effort)..."
        set +e

        if [[ "$VERIFY_BACKEND" == "blockscout" ]]; then
            forge script "$SCRIPT_PATH:$SCRIPT_NAME" \
                --rpc-url "$RPC_URL" \
                --resume \
                --verify \
                --verifier blockscout \
                --verifier-url "$VERIFY_API_URL" \
                -vvvv
        else
            forge script "$SCRIPT_PATH:$SCRIPT_NAME" \
                --rpc-url "$RPC_URL" \
                --resume \
                --verify \
                --etherscan-api-key "$ETHERSCAN_API_KEY" \
                -vvvv
        fi

        VERIFY_EXIT_CODE=$?
        set -e

        if [[ $VERIFY_EXIT_CODE -eq 0 ]]; then
            echo "✓ Verification succeeded"
        else
            echo "⚠ Verification failed (best effort - deployment data already saved)"
        fi
    fi
fi

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  Chain: $CHAIN_NAME ($CHAIN_ID)"
echo "  Target: $TARGET"
echo "============================================"
