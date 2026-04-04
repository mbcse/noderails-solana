// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../../src/NodeRailsMerchantManager.sol";

contract DeployMerchantManager is Script {
    function _parseAddresses(string memory envKey) internal view returns (address[] memory) {
        string memory raw = vm.envString(envKey);
        bytes memory b = bytes(raw);

        uint256 count = 1;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ',') count++;
        }

        string[] memory parts = new string[](count);
        uint256 start = 0;
        uint256 idx = 0;
        for (uint256 i = 0; i <= b.length; i++) {
            if (i == b.length || b[i] == ',') {
                bytes memory part = new bytes(i - start);
                for (uint256 j = start; j < i; j++) {
                    part[j - start] = b[j];
                }
                parts[idx] = string(part);
                idx++;
                start = i + 1;
            }
        }

        address[] memory addrs = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            addrs[i] = vm.parseAddress(parts[i]);
            require(addrs[i] != address(0), "Invalid admin in ADMIN_ADDRESSES");
        }
        return addrs;
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address superAdmin = vm.envAddress("SUPER_ADMIN_ADDRESS");
        address[] memory admins = _parseAddresses("ADMIN_ADDRESSES");

        require(superAdmin != address(0), "SUPER_ADMIN_ADDRESS not set");
        require(admins.length > 0, "ADMIN_ADDRESSES not set");

        for (uint256 i = 0; i < admins.length; i++) {
            require(admins[i] != superAdmin, "Admin cannot be super admin");
        }

        console.log("Deploying NodeRailsMerchantManager...");
        console.log("Chain ID:", block.chainid);
        console.log("Super Admin:", superAdmin);
        console.log("Admins:", admins.length);

        vm.startBroadcast(deployerPrivateKey);
        NodeRailsMerchantManager merchantManager = new NodeRailsMerchantManager(superAdmin, admins);
        vm.stopBroadcast();

        require(
            merchantManager.getKeyRole(superAdmin) == INodeRailsMerchantManager.KeyRole.SuperAdmin,
            "MerchantManager: Super admin not set correctly"
        );
        for (uint256 i = 0; i < admins.length; i++) {
            require(
                merchantManager.getKeyRole(admins[i]) == INodeRailsMerchantManager.KeyRole.Admin,
                "MerchantManager: Admin not set correctly"
            );
        }

        console.log("NodeRailsMerchantManager deployed at:", address(merchantManager));
        console.log("Admins set:", admins.length);
        console.log("Verification passed!");
    }
}
