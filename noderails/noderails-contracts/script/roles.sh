#!/bin/bash
set -euo pipefail

# ============================================================================
# NodeRails Role Management Script
# ============================================================================
#
# Usage:
#   ./script/roles.sh <chainId> <command>
#
# Commands:
#   setup              Full initial setup (admins + transaction keys)
#   add-tx-keys        Add transaction key(s)
#   add-admins         Add admin(s)
#   remove-keys        Remove key(s) (set role to None)
#
# Required .env variables:
#   SUPER_ADMIN_PRIVATE_KEY       Private key of super admin (privileged role txs)
#   ADMIN_PRIVATE_KEY             Private key of the first ADMIN_ADDRESSES entry (tx-key ops)
#   ADMIN_ADDRESSES               Comma-separated admin addresses
#   TRANSACTION_KEY_ADDRESSES     Comma-separated transaction key addresses
#   REMOVE_ADDRESSES              Comma-separated addresses to remove (for remove-keys)
#   LEANRPC_API_KEY               RPC provider API key
#
# Examples:
#   ./script/roles.sh 11155111 setup
#   ./script/roles.sh 11155111 add-tx-keys
#   ./script/roles.sh 11155111 add-admins
#   ./script/roles.sh 11155111 remove-keys
#
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Args ---
CHAIN_ID="${1:-}"
COMMAND="${2:-}"
EXTRA_ARG="${3:-}"

if [[ -z "$CHAIN_ID" || -z "$COMMAND" ]]; then
    echo "Usage: ./script/roles.sh <chainId> <command>"
    echo ""
    echo "Commands:"
    echo "  setup          Full initial setup (admins + transaction keys)"
    echo "  add-tx-keys    Add transaction key(s)"
    echo "  add-admins     Add admin(s)"
    echo "  remove-keys    Remove key(s)"
    exit 1
fi

if [[ -n "$EXTRA_ARG" ]]; then
    echo "Error: Unexpected argument '$EXTRA_ARG'."
    echo "Role commands do not support verification flags; verifier is always disabled for role broadcasts."
    echo "Usage: ./script/roles.sh <chainId> <command>"
    exit 1
fi

# --- Load .env ---
if [[ -f .env ]]; then
    set -a
    source .env
    set +a
fi

# --- Resolve RPC URL ---
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

# --- Load contract addresses from deployData ---
ADDRESSES_FILE="deployData/contractAddresses.json"

if [[ ! -f "$ADDRESSES_FILE" ]]; then
    echo "Error: $ADDRESSES_FILE not found. Deploy contracts first."
    exit 1
fi

export ESCROW_ADDRESS=$(python3 -c "
import json
with open('$ADDRESSES_FILE') as f:
    data = json.load(f)
print(data.get('$CHAIN_ID', {}).get('NodeRailsEscrow', ''))
")

export MERCHANT_MANAGER_ADDRESS=$(python3 -c "
import json
with open('$ADDRESSES_FILE') as f:
    data = json.load(f)
print(data.get('$CHAIN_ID', {}).get('NodeRailsMerchantManager', ''))
")

if [[ -z "$ESCROW_ADDRESS" && -z "$MERCHANT_MANAGER_ADDRESS" ]]; then
    echo "Error: No contract addresses found for chain $CHAIN_ID in $ADDRESSES_FILE"
    exit 1
fi

if [[ -z "$ESCROW_ADDRESS" ]]; then
    echo "Warning: ESCROW_ADDRESS not found for chain $CHAIN_ID. Escrow role operations will be skipped."
fi

if [[ -z "$MERCHANT_MANAGER_ADDRESS" ]]; then
    echo "Warning: MERCHANT_MANAGER_ADDRESS not found for chain $CHAIN_ID. MerchantManager role operations will be skipped."
fi

echo "============================================"
echo "  NodeRails Role Management"
echo "============================================"
echo "  Chain:             $CHAIN_NAME ($CHAIN_ID)"
echo "  Command:           $COMMAND"
echo "  Escrow:            ${ESCROW_ADDRESS:-<not deployed>}"
echo "  MerchantManager:   ${MERCHANT_MANAGER_ADDRESS:-<not deployed>}"
echo "============================================"
echo ""

# --- Map command to Solidity contract ---
case "$COMMAND" in
    setup)
        CONTRACT_NAME="SetupRoles"
        : "${SUPER_ADMIN_PRIVATE_KEY:?SUPER_ADMIN_PRIVATE_KEY is required for setup}"
        : "${ADMIN_ADDRESSES:?ADMIN_ADDRESSES is required for setup}"
        : "${TRANSACTION_KEY_ADDRESSES:?TRANSACTION_KEY_ADDRESSES is required for setup}"
        ;;
    add-tx-keys)
        CONTRACT_NAME="AddTransactionKeys"
        : "${ADMIN_PRIVATE_KEY:?ADMIN_PRIVATE_KEY is required for add-tx-keys}"
        : "${ADMIN_ADDRESSES:?ADMIN_ADDRESSES is required for add-tx-keys}"
        : "${TRANSACTION_KEY_ADDRESSES:?TRANSACTION_KEY_ADDRESSES is required}"

        export FIRST_ADMIN_ADDRESS=$(echo "$ADMIN_ADDRESSES" | cut -d',' -f1 | xargs)
        export ADMIN_PRIVATE_KEY=$(echo "$ADMIN_PRIVATE_KEY" | cut -d',' -f1 | xargs)

        if [[ -z "$ADMIN_PRIVATE_KEY" ]]; then
            echo "Error: ADMIN_PRIVATE_KEY is empty after parsing"
            exit 1
        fi

        ADMIN_SIGNER_ADDRESS=$(cast wallet address --private-key "$ADMIN_PRIVATE_KEY" 2>/dev/null || true)
        if [[ -z "$ADMIN_SIGNER_ADDRESS" ]]; then
            echo "Error: Could not derive address from ADMIN_PRIVATE_KEY (expected a single 32-byte hex key)"
            exit 1
        fi

        ADMIN_SIGNER_ADDRESS_LC=$(echo "$ADMIN_SIGNER_ADDRESS" | tr '[:upper:]' '[:lower:]')
        FIRST_ADMIN_ADDRESS_LC=$(echo "$FIRST_ADMIN_ADDRESS" | tr '[:upper:]' '[:lower:]')

        if [[ "$ADMIN_SIGNER_ADDRESS_LC" != "$FIRST_ADMIN_ADDRESS_LC" ]]; then
            echo "Error: ADMIN_PRIVATE_KEY address ($ADMIN_SIGNER_ADDRESS) must match first ADMIN_ADDRESSES entry ($FIRST_ADMIN_ADDRESS)"
            exit 1
        fi
        ;;
    add-admins)
        CONTRACT_NAME="AddAdmins"
        : "${SUPER_ADMIN_PRIVATE_KEY:?SUPER_ADMIN_PRIVATE_KEY is required for add-admins}"
        : "${ADMIN_ADDRESSES:?ADMIN_ADDRESSES is required}"
        ;;
    remove-keys)
        CONTRACT_NAME="RemoveKeys"
        : "${SUPER_ADMIN_PRIVATE_KEY:?SUPER_ADMIN_PRIVATE_KEY is required for remove-keys}"
        : "${REMOVE_ADDRESSES:?REMOVE_ADDRESSES is required}"
        ;;
    *)
        echo "Error: Unknown command '$COMMAND'. Use: setup, add-tx-keys, add-admins, remove-keys"
        exit 1
        ;;
esac

SCRIPT_PATH="script/solidity/SetupRoles.s.sol"

# Filecoin requires RPC-side gas handling for role tx broadcast.
SKIP_SIM_FLAG=""
if [[ "$CHAIN_ID" == "314159" ]]; then
    SKIP_SIM_FLAG="--skip-simulation"
fi

# Roles script does not perform source verification.
# Force-disable ETHERSCAN_API_KEY to prevent Foundry nightly from attempting verifier resolution on unsupported chains.
ETHERSCAN_API_KEY= \
forge script $SKIP_SIM_FLAG "$SCRIPT_PATH:$CONTRACT_NAME" \
    --rpc-url "$RPC_URL" \
    --broadcast \
    -vvvv

echo ""
echo "============================================"
echo "  Role management complete!"
echo "  Chain: $CHAIN_ID"
echo "  Command: $COMMAND"
echo "============================================"
