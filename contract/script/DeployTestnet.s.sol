// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HumanRegistry} from "../src/HumanRegistry.sol";
import {BlipTransactionRecorder} from "../src/BlipTransactionRecorder.sol";

/**
 * @title DeployTestnet
 * @notice Deploys HumanRegistry and BlipTransactionRecorder to World Chain Sepolia
 *
 * Usage:
 *   forge script script/DeployTestnet.s.sol:DeployTestnet \
 *     --rpc-url $WORLD_CHAIN_RPC \
 *     --broadcast \
 *     -vvvv
 */
contract DeployTestnet is Script {

    function run() external {
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // 1. Deploy HumanRegistry
        HumanRegistry registry = new HumanRegistry(admin);
        console.log("HumanRegistry deployed:", address(registry));

        // 2. Deploy BlipTransactionRecorder
        // relayer = backend relayer address
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        BlipTransactionRecorder recorder = new BlipTransactionRecorder(relayer);
        console.log("BlipTransactionRecorder deployed:", address(recorder));

        vm.stopBroadcast();

        // Print summary for .env update
        console.log("\n=== Update your .env ===");
        console.log("HUMAN_REGISTRY_ADDRESS=%s", address(registry));
        console.log("TRANSACTION_RECORDER_ADDRESS=%s", address(recorder));
    }
}
