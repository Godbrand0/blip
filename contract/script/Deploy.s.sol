// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ContentRegistry.sol";
import "../src/RoyaltyPayout.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        ContentRegistry registry = new ContentRegistry();
        RoyaltyPayout payout = new RoyaltyPayout(address(registry));

        vm.stopBroadcast();

        console.log("ContentRegistry deployed at:", address(registry));
        console.log("RoyaltyPayout deployed at:", address(payout));
    }
}
