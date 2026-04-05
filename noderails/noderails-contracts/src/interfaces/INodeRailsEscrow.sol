// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TimelocksLib.sol";

/**
 * @title INodeRailsEscrow
 * @notice Interface for the NodeRails Escrow contract
 */
interface INodeRailsEscrow {
    // ============ Enums ============

    enum PaymentStatus {
        None,
        Captured,
        Settled,
        Disputed,
        Refunded
    }

    enum KeyRole {
        None,
        TransactionKey,
        Admin,
        SuperAdmin
    }

    // ============ Structs ============

    struct Payment {
        address merchant;
        address payer;
        address token;
        uint256 amount;
        uint16 feeBps;
        PaymentStatus status;
        Timelocks timelocks;
    }

    struct PermitData {
        uint256 amount;    // The allowance value the user signed (may differ from payment amount for subscriptions)
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // ============ Events ============

    event PaymentCaptured(
        bytes32 indexed paymentIntentId,
        address indexed merchant,
        address indexed payer,
        address token,
        uint256 amount,
        uint16 feeBps,
        Timelocks timelocks
    );

    event PaymentSettled(
        bytes32 indexed paymentIntentId,
        address indexed merchant,
        uint256 merchantAmount,
        uint256 platformFee
    );

    event DisputeInitiated(
        bytes32 indexed paymentIntentId,
        address indexed merchant,
        address indexed payer
    );

    event DisputeResolved(
        bytes32 indexed paymentIntentId,
        address winner,
        uint256 amount,
        uint256 platformFee
    );

    event PaymentRefunded(
        bytes32 indexed paymentIntentId,
        address indexed payer,
        uint256 amount
    );

    event KeyRoleUpdated(address indexed key, KeyRole role);

    event FeeRecipientUpdated(address indexed newFeeRecipient);

    event FullStopped();

    event FullStopLifted();

    // ============ Functions ============

    function captureNativePayment(
        bytes32 paymentIntentId,
        address merchant,
        uint16 feeBps,
        Timelocks timelocks,
        bytes calldata noderailsSignature
    ) external payable;

    function captureERC20Payment(
        bytes32 paymentIntentId,
        address merchant,
        address token,
        uint256 amount,
        address payer,
        uint16 feeBps,
        Timelocks timelocks,
        PermitData calldata permitData,
        bytes calldata noderailsSignature
    ) external;

    function settlePayment(bytes32 paymentIntentId) external;

    function initiateDispute(bytes32 paymentIntentId) external;

    function resolveDispute(bytes32 paymentIntentId, address winner) external;

    function refundPayment(bytes32 paymentIntentId) external;

    function getPayment(bytes32 paymentIntentId) external view returns (Payment memory);

    function getKeyRole(address key) external view returns (KeyRole);

    function fullStop() external;

    function liftFullStop() external;

    function isFullStopped() external view returns (bool);
}
