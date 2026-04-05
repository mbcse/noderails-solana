// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title INodeRailsMerchantManager
 * @notice Interface for the NodeRails Merchant Manager contract that handles
 *         merchant payouts via signature-verified transfers.
 */
interface INodeRailsMerchantManager {
    // ============ Enums ============

    enum KeyRole {
        None,
        TransactionKey,
        Admin,
        SuperAdmin
    }

    // ============ Events ============

    event PayoutExecuted(
        bytes32 indexed payoutIntentId,
        address indexed merchantWallet,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event NativePayoutExecuted(
        bytes32 indexed payoutIntentId,
        address indexed merchantWallet,
        address indexed recipient,
        uint256 amount
    );

    event KeyRoleUpdated(address indexed key, KeyRole role);

    // ============ Functions ============

    /**
     * @notice Execute an ERC20 payout from merchant to recipient
     * @param payoutIntentId Unique identifier for this payout
     * @param merchantWallet Source wallet (must have approved this contract)
     * @param recipient Destination wallet
     * @param token ERC20 token address
     * @param amount Amount to transfer
     * @param sessionSignature Merchant's reusable session signature (valid until expiry)
     * @param sessionExpiry When the session signature expires
     * @param nonce Unique nonce to prevent replay (per payout)
     * @param noderailsSignature NodeRails authorization for this specific payout
     */
    function executePayout(
        bytes32 payoutIntentId,
        address merchantWallet,
        address recipient,
        address token,
        uint256 amount,
        bytes calldata sessionSignature,
        uint256 sessionExpiry,
        bytes32 nonce,
        bytes calldata noderailsSignature
    ) external;

    /**
     * @notice Execute a native ETH payout
     * @param payoutIntentId Unique identifier for this payout
     * @param merchantWallet Merchant wallet that authorized this session
     * @param recipient Destination wallet
     * @param sessionSignature Merchant's reusable session signature
     * @param sessionExpiry When the session signature expires
     * @param nonce Unique nonce to prevent replay
     * @param noderailsSignature NodeRails authorization for this specific payout
     */
    function executeNativePayout(
        bytes32 payoutIntentId,
        address merchantWallet,
        address recipient,
        bytes calldata sessionSignature,
        uint256 sessionExpiry,
        bytes32 nonce,
        bytes calldata noderailsSignature
    ) external payable;

    /**
     * @notice Check if a nonce has been used
     * @param nonce The nonce to check
     */
    function isNonceUsed(bytes32 nonce) external view returns (bool);

    /**
     * @notice Get the role of a key
     * @param key Address to check
     */
    function getKeyRole(address key) external view returns (KeyRole);
}
