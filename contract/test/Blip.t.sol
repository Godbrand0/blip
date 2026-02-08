// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContentRegistry.sol";
import "../src/RoyaltyPayout.sol";

contract BlipTest is Test {
    ContentRegistry public registry;
    RoyaltyPayout public payout;
    address public creator = address(0x1);
    address public participant = address(0x2);

    function setUp() public {
        registry = new ContentRegistry();
        payout = new RoyaltyPayout(address(registry));
    }

    function testRegisterContent() public {
        vm.prank(creator);
        address[] memory sources = new address[](1);
        sources[0] = creator;
        uint256[] memory percentages = new uint256[](1);
        percentages[0] = 100;

        uint256 contentId = registry.registerContent("hash123", "ipfs://metadata", sources, percentages);
        assertEq(contentId, 1);
        
        (address[] memory savedSources, uint256[] memory savedPercentages) = registry.getAttribution(1);
        assertEq(savedSources[0], creator);
        assertEq(savedPercentages[0], 100);

        // Test validation with World ID (isHuman = true)
        registry.validateContent(1, true);
        (,,, bool isValidated, bool isHuman,) = registry.contents(1);
        assertTrue(isValidated);
        assertTrue(isHuman);
    }

    function testRoyaltyDistribution() public {
        // Register content
        vm.prank(creator);
        address[] memory sources = new address[](2);
        sources[0] = creator;
        sources[1] = participant;
        uint256[] memory percentages = new uint256[](2);
        percentages[0] = 70;
        percentages[1] = 30;

        uint256 contentId = registry.registerContent("hash123", "ipfs://metadata", sources, percentages);

        // Distribute royalties (send 1 ETH)
        vm.deal(address(this), 1 ether);
        payout.distributeRoyalties{value: 1 ether}(contentId);

        assertEq(payout.balances(creator), 0.7 ether);
        assertEq(payout.balances(participant), 0.3 ether);
    }
}
