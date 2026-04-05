// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/INodeRailsMerchantManager.sol";

/**
 * @title NodeRailsMerchantManager
 * @notice Stateless signature-verified transfer proxy for merchant payouts
 * @dev Session signatures are REUSABLE until expiry, nonces prevent replay of individual payouts
 */
contract NodeRailsMerchantManager is INodeRailsMerchantManager, EIP712, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ============ Constants ============

    string private constant SIGNING_DOMAIN = "NodeRailsMerchantManager";
    string private constant SIGNATURE_VERSION = "1";

    // Session = merchant authorizes NodeRails to execute payouts until expiry (REUSABLE)
    bytes32 private constant SESSION_TYPEHASH = keccak256(
        "Session(address merchantWallet,uint256 sessionExpiry)"
    );

    // Payout authorization = specific payout details with nonce (SINGLE USE per nonce)
    bytes32 private constant NODERAILS_PAYOUT_TYPEHASH = keccak256(
        "NoderailsPayout(bytes32 payoutIntentId,address merchantWallet,address recipient,address token,uint256 amount,bytes32 nonce)"
    );

    bytes32 private constant NODERAILS_NATIVE_PAYOUT_TYPEHASH = keccak256(
        "NoderailsNativePayout(bytes32 payoutIntentId,address merchantWallet,address recipient,uint256 amount,bytes32 nonce)"
    );

    // ============ Storage ============

    mapping(bytes32 => bool) public usedNonces;
    mapping(address => KeyRole) public keyRoles;

    // ============ Constructor ============

    constructor(address _superAdmin, address[] memory _admins) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        require(_superAdmin != address(0), "Invalid super admin");
        require(_admins.length > 0, "At least one admin required");

        keyRoles[_superAdmin] = KeyRole.SuperAdmin;
        emit KeyRoleUpdated(_superAdmin, KeyRole.SuperAdmin);

        for (uint256 i = 0; i < _admins.length; i++) {
            address admin = _admins[i];
            require(admin != address(0), "Invalid admin");
            require(admin != _superAdmin, "Admin cannot be super admin");
            keyRoles[admin] = KeyRole.Admin;
            emit KeyRoleUpdated(admin, KeyRole.Admin);
        }
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

    // ============ External Functions ============

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
    ) external nonReentrant whenNotPaused onlyTransactionKey {
        require(merchantWallet != address(0), "Invalid merchant wallet");
        require(recipient != address(0), "Invalid recipient");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");

        _useNonce(nonce);
        require(block.timestamp < sessionExpiry, "Session expired");

        // Verify merchant's session (reusable until expiry)
        _verifySession(merchantWallet, sessionExpiry, sessionSignature);

        // Verify noderails authorization for this specific payout
        _verifyNoderailsSignature(
            keccak256(abi.encode(
                NODERAILS_PAYOUT_TYPEHASH,
                payoutIntentId,
                merchantWallet,
                recipient,
                token,
                amount,
                nonce
            )),
            noderailsSignature
        );

        _transferFrom(token, merchantWallet, recipient, amount);

        emit PayoutExecuted(payoutIntentId, merchantWallet, recipient, token, amount);
    }

    function executeNativePayout(
        bytes32 payoutIntentId,
        address merchantWallet,
        address recipient,
        bytes calldata sessionSignature,
        uint256 sessionExpiry,
        bytes32 nonce,
        bytes calldata noderailsSignature
    ) external payable nonReentrant whenNotPaused onlyTransactionKey {
        require(merchantWallet != address(0), "Invalid merchant wallet");
        require(recipient != address(0), "Invalid recipient");
        require(msg.value > 0, "No ETH sent");

        _useNonce(nonce);
        require(block.timestamp < sessionExpiry, "Session expired");

        // Verify merchant's session (reusable until expiry)
        _verifySession(merchantWallet, sessionExpiry, sessionSignature);

        // Verify noderails authorization for this specific payout
        _verifyNoderailsSignature(
            keccak256(abi.encode(
                NODERAILS_NATIVE_PAYOUT_TYPEHASH,
                payoutIntentId,
                merchantWallet,
                recipient,
                msg.value,
                nonce
            )),
            noderailsSignature
        );

        _transferETH(recipient, msg.value);

        emit NativePayoutExecuted(payoutIntentId, merchantWallet, recipient, msg.value);
    }

    // ============ Admin Functions ============

    function setKeyRole(address key, KeyRole role) external {
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

    function pause() external onlySuperAdmin { _pause(); }
    function unpause() external onlySuperAdmin { _unpause(); }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlySuperAdmin nonReentrant {
        require(to != address(0), "Invalid recipient");
        if (token == address(0)) {
            _transferETH(to, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ============ View Functions ============

    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }

    function getKeyRole(address key) external view returns (KeyRole) {
        return keyRoles[key];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============ Internal Functions ============

    function _useNonce(bytes32 nonce) internal {
        require(!usedNonces[nonce], "Nonce already used");
        usedNonces[nonce] = true;
    }

    function _recoverSigner(bytes32 structHash, bytes calldata signature) internal view returns (address) {
        return _hashTypedDataV4(structHash).recover(signature);
    }

    function _verifySession(
        address merchantWallet,
        uint256 sessionExpiry,
        bytes calldata signature
    ) internal view {
        bytes32 structHash = keccak256(abi.encode(
            SESSION_TYPEHASH,
            merchantWallet,
            sessionExpiry
        ));
        address signer = _recoverSigner(structHash, signature);
        require(signer == merchantWallet, "Invalid session signature");
    }

    function _verifyNoderailsSignature(bytes32 structHash, bytes calldata signature) internal view {
        address signer = _recoverSigner(structHash, signature);
        require(_isAuthorizedKey(signer), "Invalid noderails signature");
    }

    function _isAuthorizedKey(address key) internal view returns (bool) {
        KeyRole role = keyRoles[key];
        return role == KeyRole.TransactionKey || role == KeyRole.Admin || role == KeyRole.SuperAdmin;
    }

    function _transferFrom(address token, address from, address to, uint256 amount) internal {
        IERC20(token).safeTransferFrom(from, to, amount);
    }

    function _transferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    receive() external payable {}
}
