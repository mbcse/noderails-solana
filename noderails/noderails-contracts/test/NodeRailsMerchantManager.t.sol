// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/NodeRailsMerchantManager.sol";
import "../src/interfaces/INodeRailsMerchantManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract NodeRailsMerchantManagerTest is Test {
    NodeRailsMerchantManager public manager;
    MockERC20 public mockToken;

    address public superAdmin;
    uint256 public superAdminKey;
    
    address public admin;
    uint256 public adminKey;
    
    address public transactionKey;
    uint256 public transactionKeyPrivate;
    
    address public merchantWallet;
    uint256 public merchantWalletKey;
    
    address public recipient;
    address public recipient2;

    uint256 public constant PAYOUT_AMOUNT = 100 * 10**18;

    // Session = reusable until expiry
    bytes32 private constant SESSION_TYPEHASH = keccak256(
        "Session(address merchantWallet,uint256 sessionExpiry)"
    );

    // Payout = single use per nonce
    bytes32 private constant NODERAILS_PAYOUT_TYPEHASH = keccak256(
        "NoderailsPayout(bytes32 payoutIntentId,address merchantWallet,address recipient,address token,uint256 amount,bytes32 nonce)"
    );

    bytes32 private constant NODERAILS_NATIVE_PAYOUT_TYPEHASH = keccak256(
        "NoderailsNativePayout(bytes32 payoutIntentId,address merchantWallet,address recipient,uint256 amount,bytes32 nonce)"
    );

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

    function setUp() public {
        (superAdmin, superAdminKey) = makeAddrAndKey("superAdmin");
        (admin, adminKey) = makeAddrAndKey("admin");
        (transactionKey, transactionKeyPrivate) = makeAddrAndKey("transactionKey");
        (merchantWallet, merchantWalletKey) = makeAddrAndKey("merchantWallet");
        recipient = makeAddr("recipient");
        recipient2 = makeAddr("recipient2");

        address[] memory initialAdmins = new address[](1);
        initialAdmins[0] = admin;

        vm.prank(superAdmin);
        manager = new NodeRailsMerchantManager(superAdmin, initialAdmins);

        vm.startPrank(superAdmin);
        manager.setKeyRole(admin, INodeRailsMerchantManager.KeyRole.Admin);
        manager.setKeyRole(transactionKey, INodeRailsMerchantManager.KeyRole.TransactionKey);
        vm.stopPrank();

        mockToken = new MockERC20();
        mockToken.mint(merchantWallet, PAYOUT_AMOUNT * 10);

        vm.prank(merchantWallet);
        mockToken.approve(address(manager), type(uint256).max);

        vm.deal(transactionKey, 100 ether);
    }

    // ============ Constructor Tests ============

    function test_Constructor() public view {
        assertEq(uint256(manager.getKeyRole(superAdmin)), uint256(INodeRailsMerchantManager.KeyRole.SuperAdmin));
        assertEq(uint256(manager.getKeyRole(admin)), uint256(INodeRailsMerchantManager.KeyRole.Admin));
    }

    function test_Constructor_InvalidSuperAdmin() public {
        address[] memory initialAdmins = new address[](1);
        initialAdmins[0] = admin;
        vm.expectRevert("Invalid super admin");
        new NodeRailsMerchantManager(address(0), initialAdmins);
    }

    // ============ ERC20 Payout Tests ============

    function test_ExecutePayout() public {
        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsPayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce
        );

        uint256 recipientBalanceBefore = mockToken.balanceOf(recipient);

        vm.expectEmit(true, true, true, true);
        emit PayoutExecuted(payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT);

        vm.prank(transactionKey);
        manager.executePayout(
            payoutIntentId,
            merchantWallet,
            recipient,
            address(mockToken),
            PAYOUT_AMOUNT,
            sessionSig,
            sessionExpiry,
            nonce,
            noderailsSig
        );

        assertEq(mockToken.balanceOf(recipient) - recipientBalanceBefore, PAYOUT_AMOUNT);
        assertTrue(manager.isNonceUsed(nonce));
    }

    function test_ExecutePayout_SessionReusable() public {
        uint256 sessionExpiry = block.timestamp + 1 hours;
        
        // Sign session ONCE
        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);

        // First payout to recipient1
        bytes32 nonce1 = keccak256("nonce1");
        bytes memory noderailsSig1 = _signNoderailsPayout(
            keccak256("payout1"), merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce1
        );

        vm.prank(transactionKey);
        manager.executePayout(
            keccak256("payout1"),
            merchantWallet,
            recipient,
            address(mockToken),
            PAYOUT_AMOUNT,
            sessionSig,  // SAME session
            sessionExpiry,
            nonce1,
            noderailsSig1
        );

        // Second payout to recipient2 using SAME session signature
        bytes32 nonce2 = keccak256("nonce2");
        bytes memory noderailsSig2 = _signNoderailsPayout(
            keccak256("payout2"), merchantWallet, recipient2, address(mockToken), PAYOUT_AMOUNT, nonce2
        );

        vm.prank(transactionKey);
        manager.executePayout(
            keccak256("payout2"),
            merchantWallet,
            recipient2,
            address(mockToken),
            PAYOUT_AMOUNT,
            sessionSig,  // SAME session reused!
            sessionExpiry,
            nonce2,
            noderailsSig2
        );

        assertEq(mockToken.balanceOf(recipient), PAYOUT_AMOUNT);
        assertEq(mockToken.balanceOf(recipient2), PAYOUT_AMOUNT);
    }

    function test_ExecutePayout_NonceReplay() public {
        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsPayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce
        );

        vm.prank(transactionKey);
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );

        // Try to replay with same nonce
        vm.prank(transactionKey);
        vm.expectRevert("Nonce already used");
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    function test_ExecutePayout_SessionExpired() public {
        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsPayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce
        );

        vm.warp(block.timestamp + 2 hours);

        vm.prank(transactionKey);
        vm.expectRevert("Session expired");
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    function test_ExecutePayout_InvalidSessionSignature() public {
        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        // Sign with wrong key
        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, adminKey);
        bytes memory noderailsSig = _signNoderailsPayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce
        );

        vm.prank(transactionKey);
        vm.expectRevert("Invalid session signature");
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    function test_ExecutePayout_InvalidNoderailsSignature() public {
        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        // Sign with unauthorized key
        bytes memory noderailsSig = _signNoderailsPayoutWithKey(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce, merchantWalletKey
        );

        vm.prank(transactionKey);
        vm.expectRevert("Invalid noderails signature");
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    function test_ExecutePayout_OnlyTransactionKey() public {
        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsPayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce
        );

        vm.prank(merchantWallet);
        vm.expectRevert("Not authorized");
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    // ============ Native Payout Tests ============

    function test_ExecuteNativePayout() public {
        bytes32 payoutIntentId = keccak256("nativePayout1");
        bytes32 nonce = keccak256("nativeNonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;
        uint256 amount = 1 ether;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsNativePayout(
            payoutIntentId, merchantWallet, recipient, amount, nonce
        );

        uint256 recipientBalanceBefore = recipient.balance;

        vm.expectEmit(true, true, true, true);
        emit NativePayoutExecuted(payoutIntentId, merchantWallet, recipient, amount);

        vm.prank(transactionKey);
        manager.executeNativePayout{value: amount}(
            payoutIntentId,
            merchantWallet,
            recipient,
            sessionSig,
            sessionExpiry,
            nonce,
            noderailsSig
        );

        assertEq(recipient.balance - recipientBalanceBefore, amount);
    }

    function test_ExecuteNativePayout_SessionReusable() public {
        uint256 sessionExpiry = block.timestamp + 1 hours;
        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);

        // First native payout
        bytes32 nonce1 = keccak256("nonce1");
        bytes memory noderailsSig1 = _signNoderailsNativePayout(
            keccak256("payout1"), merchantWallet, recipient, 1 ether, nonce1
        );

        vm.prank(transactionKey);
        manager.executeNativePayout{value: 1 ether}(
            keccak256("payout1"), merchantWallet, recipient, sessionSig, sessionExpiry, nonce1, noderailsSig1
        );

        // Second native payout with SAME session
        bytes32 nonce2 = keccak256("nonce2");
        bytes memory noderailsSig2 = _signNoderailsNativePayout(
            keccak256("payout2"), merchantWallet, recipient2, 2 ether, nonce2
        );

        vm.prank(transactionKey);
        manager.executeNativePayout{value: 2 ether}(
            keccak256("payout2"), merchantWallet, recipient2, sessionSig, sessionExpiry, nonce2, noderailsSig2
        );

        assertEq(recipient.balance, 1 ether);
        assertEq(recipient2.balance, 2 ether);
    }

    function test_ExecuteNativePayout_NoETH() public {
        bytes32 payoutIntentId = keccak256("nativePayout1");
        bytes32 nonce = keccak256("nativeNonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsNativePayout(
            payoutIntentId, merchantWallet, recipient, 1 ether, nonce
        );

        vm.prank(transactionKey);
        vm.expectRevert("No ETH sent");
        manager.executeNativePayout{value: 0}(
            payoutIntentId, merchantWallet, recipient, sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    // ============ Admin Tests ============

    function test_SetKeyRole() public {
        address newKey = makeAddr("newKey");

        vm.prank(superAdmin);
        manager.setKeyRole(newKey, INodeRailsMerchantManager.KeyRole.TransactionKey);

        assertEq(uint256(manager.getKeyRole(newKey)), uint256(INodeRailsMerchantManager.KeyRole.TransactionKey));
    }

    function test_Pause() public {
        vm.prank(superAdmin);
        manager.pause();

        assertTrue(manager.paused());
    }

    function test_ExecutePayoutWhenPaused() public {
        vm.prank(superAdmin);
        manager.pause();

        bytes32 payoutIntentId = keccak256("payout1");
        bytes32 nonce = keccak256("nonce1");
        uint256 sessionExpiry = block.timestamp + 1 hours;

        bytes memory sessionSig = _signSession(merchantWallet, sessionExpiry, merchantWalletKey);
        bytes memory noderailsSig = _signNoderailsPayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT, nonce
        );

        vm.prank(transactionKey);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        manager.executePayout(
            payoutIntentId, merchantWallet, recipient, address(mockToken), PAYOUT_AMOUNT,
            sessionSig, sessionExpiry, nonce, noderailsSig
        );
    }

    // ============ Helper Functions ============

    function _signSession(
        address _merchantWallet,
        uint256 sessionExpiry,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            SESSION_TYPEHASH,
            _merchantWallet,
            sessionExpiry
        ));

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", manager.domainSeparator(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signNoderailsPayout(
        bytes32 payoutIntentId,
        address _merchantWallet,
        address _recipient,
        address token,
        uint256 amount,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        return _signNoderailsPayoutWithKey(
            payoutIntentId, _merchantWallet, _recipient, token, amount, nonce, transactionKeyPrivate
        );
    }

    function _signNoderailsPayoutWithKey(
        bytes32 payoutIntentId,
        address _merchantWallet,
        address _recipient,
        address token,
        uint256 amount,
        bytes32 nonce,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            NODERAILS_PAYOUT_TYPEHASH,
            payoutIntentId,
            _merchantWallet,
            _recipient,
            token,
            amount,
            nonce
        ));

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", manager.domainSeparator(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signNoderailsNativePayout(
        bytes32 payoutIntentId,
        address _merchantWallet,
        address _recipient,
        uint256 amount,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            NODERAILS_NATIVE_PAYOUT_TYPEHASH,
            payoutIntentId,
            _merchantWallet,
            _recipient,
            amount,
            nonce
        ));

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", manager.domainSeparator(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(transactionKeyPrivate, digest);
        return abi.encodePacked(r, s, v);
    }
}
