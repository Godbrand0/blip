// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ContentRegistry.sol";

/**
 * @title RoyaltyPayout
 * @dev Manages royalty distribution based on content attribution.
 */
contract RoyaltyPayout is Ownable {
    ContentRegistry public registry;

    mapping(address => uint256) public balances;

    event RoyaltiesDistributed(uint256 indexed contentId, uint256 amount);
    event RoyaltiesClaimed(address indexed creator, uint256 amount);

    constructor(address _registry) Ownable(msg.sender) {
        registry = ContentRegistry(_registry);
    }

    /**
     * @dev Distributes royalties for a specific content ID.
     * In a real scenario, this would be payable or triggered by a payment handler.
     */
    function distributeRoyalties(uint256 contentId) external payable {
        require(msg.value > 0, "No royalties sent");
        
        (address[] memory sources, uint256[] memory percentages) = registry.getAttribution(contentId);
        require(sources.length > 0, "No attribution found");

        uint256 distributedAmount = 0;
        for (uint256 i = 0; i < sources.length; i++) {
            uint256 share = (msg.value * percentages[i]) / 100;
            balances[sources[i]] += share;
            distributedAmount += share;
        }

        // If there's a remainder (e.g. attribution doesn't sum to 100%), send it to the content creator
        uint256 remainder = msg.value - distributedAmount;
        if (remainder > 0) {
            balances[registry.getCreator(contentId)] += remainder;
        }

        emit RoyaltiesDistributed(contentId, msg.value);
    }

    /**
     * @dev Allows creators to pull their accumulated royalties.
     */
    function claimRoyalties() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to claim");

        balances[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit RoyaltiesClaimed(msg.sender, amount);
    }

    // Helper to update registry address if needed
    function updateRegistry(address _registry) external onlyOwner {
        registry = ContentRegistry(_registry);
    }
}
