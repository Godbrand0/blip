// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ContentRegistry
 * @dev Manages the registration and validation of content for the BLIP platform.
 */
contract ContentRegistry is Ownable {
    struct Content {
        string contentHash;
        string metadataURI;
        address creator;
        address[] attributedSources;
        uint256[] attributionPercentages;
        bool isValidated;
        bool isHuman; // Added for World ID integration
        uint256 timestamp;
    }

    mapping(uint256 => Content) public contents;
    mapping(string => bool) public registeredHashes;
    uint256 public nextContentId = 1;

    event ContentRegistered(uint256 indexed contentId, string contentHash, address indexed creator);
    event ContentValidated(uint256 indexed contentId);
    event HumanVerificationResult(uint256 indexed contentId, bool isHuman);
    event AttributionUpdated(uint256 indexed contentId, address[] sources, uint256[] percentages);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Registers new content.
     * @param contentHash IPFS hash or unique identifier of the content.
     * @param metadataURI URI for additional metadata.
     * @param attributedSources Array of addresses that contributed to this content.
     * @param attributionPercentages Respective percentages for each source.
     */
    function registerContent(
        string memory contentHash,
        string memory metadataURI,
        address[] memory attributedSources,
        uint256[] memory attributionPercentages
    ) external returns (uint256 contentId) {
        require(!registeredHashes[contentHash], "Content already registered");
        require(attributedSources.length == attributionPercentages.length, "Mismatched attribution data");
        
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < attributionPercentages.length; i++) {
            totalPercentage += attributionPercentages[i];
        }
        require(totalPercentage <= 100, "Total attribution exceeds 100%");

        contentId = nextContentId++;
        
        contents[contentId] = Content({
            contentHash: contentHash,
            metadataURI: metadataURI,
            creator: msg.sender,
            attributedSources: attributedSources,
            attributionPercentages: attributionPercentages,
            isValidated: false,
            isHuman: false,
            timestamp: block.timestamp
        });

        registeredHashes[contentHash] = true;

        emit ContentRegistered(contentId, contentHash, msg.sender);
    }

    /**
     * @dev Marks content as validated by the CRE (Chainlink External Adapter hook).
     * @param contentId ID of the content to validate.
     */
    function validateContent(uint256 contentId, bool isHuman) external onlyOwner {
        require(contents[contentId].timestamp != 0, "Content does not exist");
        contents[contentId].isValidated = true;
        contents[contentId].isHuman = isHuman;
        emit ContentValidated(contentId);
        emit HumanVerificationResult(contentId, isHuman);
    }

    /**
     * @dev Updates attribution for existing content.
     */
    function updateAttribution(
        uint256 contentId,
        address[] memory sources,
        uint256[] memory percentages
    ) external {
        require(contents[contentId].creator == msg.sender, "Only creator can update");
        require(!contents[contentId].isValidated, "Cannot update validated content");
        require(sources.length == percentages.length, "Mismatched data");

        contents[contentId].attributedSources = sources;
        contents[contentId].attributionPercentages = percentages;

        emit AttributionUpdated(contentId, sources, percentages);
    }
    
    function getAttribution(uint256 contentId) external view returns (address[] memory, uint256[] memory) {
        return (contents[contentId].attributedSources, contents[contentId].attributionPercentages);
    }

    function getCreator(uint256 contentId) external view returns (address) {
        return contents[contentId].creator;
    }
}
