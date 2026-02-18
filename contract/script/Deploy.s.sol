// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HumanRegistry} from "../src/HumanRegistry.sol";
import {CCIPExecutionVault} from "../src/CCIPExecutionVault.sol";

/**
 * @title Deploy
 * @notice Deploys HumanRegistry and CCIPExecutionVault to Base Mainnet
 *
 * Verify addresses before deploying:
 *   CCIP Router:  https://docs.chain.link/ccip/directory/mainnet/chain/base-mainnet
 *   LINK token:   https://docs.chain.link/resources/link-token-contracts#base-mainnet
 *   USDC:         https://www.circle.com/en/usdc/multichain (Base Mainnet)
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url base \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract Deploy is Script {

    // ─── Base Mainnet Addresses ─────────────────────────────────────────────
    // Verify these at the links above before deploying

    /// @dev Chainlink CCIP Router on Base Mainnet
    address constant CCIP_ROUTER   = 0x881e3A65B4d4a04dD529061dd0071cf975F58bCD;

    /// @dev LINK token on Base Mainnet
    address constant LINK_TOKEN    = 0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196;

    /// @dev USDC on Base Mainnet (Circle native)
    address constant USDC_TOKEN    = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

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
