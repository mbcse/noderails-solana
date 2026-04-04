// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/INodeRailsEscrow.sol";

/**
 * @title NodeRailsEscrow
 * @notice Escrow contract for NodeRails payment platform
 */
contract NodeRailsEscrow is INodeRailsEscrow, EIP712, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using TimelocksLib for Timelocks;

    // ============ Constants ============

    string private constant SIGNING_DOMAIN = "NodeRailsEscrow";
    string private constant SIGNATURE_VERSION = "1";

    uint16 public constant MAX_FEE_BPS = 1000; // Max 10% fee

    bytes32 private constant CAPTURE_NATIVE_TYPEHASH = keccak256(
        "CaptureNativePayment(bytes32 paymentIntentId,address merchant,uint256 amount,uint16 feeBps,uint256 timelocks,uint256 nonce)"
    );

    bytes32 private constant CAPTURE_ERC20_TYPEHASH = keccak256(
        "CaptureERC20Payment(bytes32 paymentIntentId,address merchant,address token,uint256 amount,address payer,uint16 feeBps,uint256 timelocks,uint256 nonce)"
    );

    // ============ Storage ============

    mapping(bytes32 => Payment) public payments;
    mapping(address => KeyRole) public keyRoles;
    mapping(bytes32 => bool) public usedNonces;
    address public feeRecipient;
    bool public fullStopped;

    // ============ Constructor ============

    constructor(
        address _superAdmin,
        address[] memory _admins,
        address _feeRecipient
    ) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        require(_superAdmin != address(0), "Invalid super admin");
        require(_admins.length > 0, "At least one admin required");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        keyRoles[_superAdmin] = KeyRole.SuperAdmin;
        emit KeyRoleUpdated(_superAdmin, KeyRole.SuperAdmin);

        for (uint256 i = 0; i < _admins.length; i++) {
            address admin = _admins[i];
            require(admin != address(0), "Invalid admin");
            require(admin != _superAdmin, "Admin cannot be super admin");
            keyRoles[admin] = KeyRole.Admin;
            emit KeyRoleUpdated(admin, KeyRole.Admin);
        }

        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    // ============ Modifiers ============

    modifier onlySuperAdmin() {
        require(keyRoles[msg.sender] == KeyRole.SuperAdmin, "Not super admin");
        _;
    }

    modifier onlyAdmin() {
        require(
            keyRoles[msg.sender] == KeyRole.Admin || keyRoles[msg.sender] == KeyRole.SuperAdmin,
            "Not admin"
        );
        _;
    }

    modifier onlyTransactionKey() {
        require(
            keyRoles[msg.sender] == KeyRole.TransactionKey ||
            keyRoles[msg.sender] == KeyRole.Admin ||
            keyRoles[msg.sender] == KeyRole.SuperAdmin,
            "Not authorized"
        );
        _;
    }

    modifier onlyTransactionKeyOrMerchant(bytes32 paymentIntentId) {
        require(
            keyRoles[msg.sender] == KeyRole.TransactionKey ||
            keyRoles[msg.sender] == KeyRole.Admin ||
            keyRoles[msg.sender] == KeyRole.SuperAdmin ||
            msg.sender == payments[paymentIntentId].merchant,
            "Not authorized"
        );
        _;
    }

    modifier whenNotFullStop() {
        require(!fullStopped, "Contract is full stopped");
        _;
    }

    modifier onlyFullStop() {
        require(fullStopped, "Contract is not full stopped");
        _;
    }

    modifier onlyBefore(bytes32 paymentIntentId, TimelocksLib.Stage stage) {
        require(block.timestamp < payments[paymentIntentId].timelocks.get(stage), "Too late");
        _;
    }

    modifier onlyAfter(bytes32 paymentIntentId, TimelocksLib.Stage stage) {
        require(block.timestamp >= payments[paymentIntentId].timelocks.get(stage), "Too early");
        _;
    }

    modifier onlyStatus(bytes32 paymentIntentId, PaymentStatus expectedStatus) {
        require(payments[paymentIntentId].status == expectedStatus, "Invalid status");
        _;
    }

    // ============ External Functions ============

    function captureNativePayment(
        bytes32 paymentIntentId,
        address merchant,
        uint16 feeBps,
        Timelocks timelocks,
        bytes calldata noderailsSignature
    ) external payable nonReentrant whenNotFullStop whenNotPaused {
        require(msg.value > 0, "No ETH sent");
        require(merchant != address(0), "Invalid merchant");
        require(feeBps <= MAX_FEE_BPS, "Fee too high");
        require(payments[paymentIntentId].status == PaymentStatus.None, "Payment exists");
        _validateTimelocks(timelocks);

        bytes32 nonce = keccak256(abi.encodePacked(paymentIntentId, "native"));
        require(!usedNonces[nonce], "Nonce already used");
        usedNonces[nonce] = true;

        _verifyNoderailsSignature(
            keccak256(abi.encode(
                CAPTURE_NATIVE_TYPEHASH,
                paymentIntentId,
                merchant,
                msg.value,
                feeBps,
                Timelocks.unwrap(timelocks),
                nonce
            )),
            noderailsSignature
        );

        payments[paymentIntentId] = Payment({
            merchant: merchant,
            payer: msg.sender,
            token: address(0),
            amount: msg.value,
            feeBps: feeBps,
            status: PaymentStatus.Captured,
            timelocks: timelocks
        });

        emit PaymentCaptured(paymentIntentId, merchant, msg.sender, address(0), msg.value, feeBps, timelocks);
    }

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
    ) external nonReentrant whenNotFullStop whenNotPaused onlyTransactionKey {
        require(amount > 0, "Invalid amount");
        require(merchant != address(0), "Invalid merchant");
        require(token != address(0), "Invalid token");
        require(payer != address(0), "Invalid payer");
        require(feeBps <= MAX_FEE_BPS, "Fee too high");
        require(payments[paymentIntentId].status == PaymentStatus.None, "Payment exists");
        _validateTimelocks(timelocks);

        bytes32 nonce = keccak256(abi.encodePacked(paymentIntentId, "erc20"));
        require(!usedNonces[nonce], "Nonce already used");
        usedNonces[nonce] = true;

        _verifyNoderailsSignature(
            keccak256(abi.encode(
                CAPTURE_ERC20_TYPEHASH,
                paymentIntentId,
                merchant,
                token,
                amount,
                payer,
                feeBps,
                Timelocks.unwrap(timelocks),
                nonce
            )),
            noderailsSignature
        );

        _executePermit(token, payer, permitData);
        _transferIn(token, payer, amount);

        payments[paymentIntentId] = Payment({
            merchant: merchant,
            payer: payer,
            token: token,
            amount: amount,
            feeBps: feeBps,
            status: PaymentStatus.Captured,
            timelocks: timelocks
        });

        emit PaymentCaptured(paymentIntentId, merchant, payer, token, amount, feeBps, timelocks);
    }

    function settlePayment(bytes32 paymentIntentId) 
        external 
        nonReentrant
        whenNotFullStop
        onlyTransactionKeyOrMerchant(paymentIntentId)
        onlyStatus(paymentIntentId, PaymentStatus.Captured)
        onlyAfter(paymentIntentId, TimelocksLib.Stage.Settlement)
    {
        Payment storage payment = payments[paymentIntentId];
        payment.status = PaymentStatus.Settled;

        (uint256 merchantAmount, uint256 fee) = _splitFee(payment.amount, payment.feeBps);
        _transferOut(payment.token, payment.merchant, merchantAmount);
        if (fee > 0) {
            _transferOut(payment.token, feeRecipient, fee);
        }

        emit PaymentSettled(paymentIntentId, payment.merchant, merchantAmount, fee);
    }

    function initiateDispute(bytes32 paymentIntentId) 
        external 
        nonReentrant
        whenNotFullStop
        onlyTransactionKey
        onlyStatus(paymentIntentId, PaymentStatus.Captured)
        onlyAfter(paymentIntentId, TimelocksLib.Stage.DisputeStart)
        onlyBefore(paymentIntentId, TimelocksLib.Stage.Settlement)
    {
        Payment storage payment = payments[paymentIntentId];
        payment.status = PaymentStatus.Disputed;

        emit DisputeInitiated(paymentIntentId, payment.merchant, payment.payer);
    }

    function resolveDispute(bytes32 paymentIntentId, address winner) 
        external 
        nonReentrant
        whenNotFullStop
        onlyTransactionKey
        onlyStatus(paymentIntentId, PaymentStatus.Disputed)
    {
        Payment storage payment = payments[paymentIntentId];
        require(winner == payment.merchant || winner == payment.payer, "Invalid winner");

        if (winner == payment.merchant) {
            payment.status = PaymentStatus.Settled;
            (uint256 merchantAmount, uint256 fee) = _splitFee(payment.amount, payment.feeBps);
            _transferOut(payment.token, payment.merchant, merchantAmount);
            if (fee > 0) {
                _transferOut(payment.token, feeRecipient, fee);
            }
            emit DisputeResolved(paymentIntentId, winner, merchantAmount, fee);
        } else {
            payment.status = PaymentStatus.Refunded;
            _transferOut(payment.token, payment.payer, payment.amount);
            emit DisputeResolved(paymentIntentId, winner, payment.amount, 0);
        }
    }

    function refundPayment(bytes32 paymentIntentId)
        external
        nonReentrant
        whenNotFullStop
        onlyTransactionKey
        onlyStatus(paymentIntentId, PaymentStatus.Captured)
        onlyBefore(paymentIntentId, TimelocksLib.Stage.Settlement)
    {
        Payment storage payment = payments[paymentIntentId];
        payment.status = PaymentStatus.Refunded;

        _transferOut(payment.token, payment.payer, payment.amount);

        emit PaymentRefunded(paymentIntentId, payment.payer, payment.amount);
    }

    // ============ Admin Functions ============

    function setKeyRole(address key, KeyRole role) external whenNotFullStop {
        require(key != address(0), "Invalid key");

        if (keyRoles[msg.sender] == KeyRole.SuperAdmin) {
            if (role != KeyRole.SuperAdmin && keyRoles[key] == KeyRole.SuperAdmin) {
                require(msg.sender != key, "Cannot remove self as super admin");
            }
            keyRoles[key] = role;
            emit KeyRoleUpdated(key, role);
            return;
        }

        if (keyRoles[msg.sender] == KeyRole.Admin) {
            require(role == KeyRole.TransactionKey || role == KeyRole.None, "Admin cannot set this role");
            require(keyRoles[key] != KeyRole.SuperAdmin && keyRoles[key] != KeyRole.Admin, "Cannot modify admin/super admin");
            keyRoles[key] = role;
            emit KeyRoleUpdated(key, role);
            return;
        }

        revert("Not authorized");
    }

    function setFeeRecipient(address _feeRecipient) external onlyAdmin whenNotFullStop {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function pause() external onlySuperAdmin whenNotFullStop { _pause(); }
    function unpause() external onlySuperAdmin whenNotFullStop { _unpause(); }

    function fullStop() external onlySuperAdmin {
        require(!fullStopped, "Already full stopped");
        fullStopped = true;
        emit FullStopped();
    }

    function liftFullStop() external onlySuperAdmin {
        require(fullStopped, "Not full stopped");
        fullStopped = false;
        emit FullStopLifted();
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlySuperAdmin onlyFullStop nonReentrant {
        require(to != address(0), "Invalid recipient");
        _transferOut(token, to, amount);
    }

    // ============ View Functions ============

    function getPayment(bytes32 paymentIntentId) external view returns (Payment memory) {
        return payments[paymentIntentId];
    }

    function getKeyRole(address key) external view returns (KeyRole) {
        return keyRoles[key];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function isFullStopped() external view returns (bool) {
        return fullStopped;
    }

    // ============ Internal Functions ============

    function _verifyNoderailsSignature(bytes32 structHash, bytes calldata signature) internal view {
        address signer = _hashTypedDataV4(structHash).recover(signature);
        require(_isAuthorizedKey(signer), "Invalid signature");
    }

    function _isAuthorizedKey(address key) internal view returns (bool) {
        KeyRole role = keyRoles[key];
        return role == KeyRole.TransactionKey || role == KeyRole.Admin || role == KeyRole.SuperAdmin;
    }

    function _executePermit(
        address token,
        address owner,
        PermitData calldata permitData
    ) internal {
        if (permitData.deadline > 0) {
            try IERC20Permit(token).permit(
                owner, address(this), permitData.amount, permitData.deadline, permitData.v, permitData.r, permitData.s
            ) {} catch {}
        }
    }

    function _transferIn(address token, address from, uint256 amount) internal {
        IERC20(token).safeTransferFrom(from, address(this), amount);
    }

    function _transferOut(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _splitFee(uint256 amount, uint16 feeBps) internal pure returns (uint256 merchantAmount, uint256 fee) {
        fee = (amount * feeBps) / 10000;
        merchantAmount = amount - fee;
    }

    function _validateTimelocks(Timelocks timelocks) internal pure {
        uint256 data = Timelocks.unwrap(timelocks);
        uint256 capturedAt = data >> 224;
        uint256 settlement = uint32(data >> 64);
        uint256 disputeStart = uint32(data >> 32);
        require(capturedAt > 0, "Invalid capturedAt");
        require(settlement > 0, "Invalid settlement timelock");
        require(disputeStart <= settlement, "Dispute must start before settlement");
    }

    receive() external payable {}
}
