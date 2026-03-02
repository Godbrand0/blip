// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HumanRegistry} from "../src/HumanRegistry.sol";
import {CCIPExecutionVault} from "../src/CCIPExecutionVault.sol";

/**
 * @title DeployTestnet
 * @notice Deploys HumanRegistry and CCIPExecutionVault to World Chain Sepolia
 *
 * Usage:
 *   forge script script/DeployTestnet.s.sol:DeployTestnet \
 *     --rpc-url $WORLD_CHAIN_RPC \
 *     --broadcast \
 *     -vvvv
 */
contract DeployTestnet is Script {

    // ─── World Chain Sepolia Addresses ──────────────────────────────────────
    
    /// @dev Chainlink CCIP Router on World Chain Sepolia
    address constant CCIP_ROUTER   = 0x4769623838e83D046AeEB099042a98D081916e8d;

    /// @dev LINK token on World Chain Sepolia
    address constant LINK_TOKEN    = 0x779877A7B0D9E8603169DdbD7836e478b4624789;

    /// @dev USDC on World Chain Sepolia
    address constant USDC_TOKEN    = 0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88;

    // ────────────────────────────────────────────────────────────────────────

    function run() external {
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // 1. Deploy HumanRegistry
        HumanRegistry registry = new HumanRegistry(admin);
        console.log("HumanRegistry deployed:", address(registry));

        // 2. Deploy CCIPExecutionVault
        CCIPExecutionVault vault = new CCIPExecutionVault(
            CCIP_ROUTER,
            LINK_TOKEN,
            USDC_TOKEN,
            address(registry),
            admin
        );
        console.log("CCIPExecutionVault deployed:", address(vault));

        vm.stopBroadcast();

        // Print summary for .env update
        console.log("\n=== Update your .env ===");
        console.log("HUMAN_REGISTRY_ADDRESS=%s", address(registry));
        console.log("EXECUTION_VAULT_ADDRESS=%s", address(vault));
    }
}
