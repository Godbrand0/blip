// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HumanRegistry
 * @notice Stores verified humans via World ID
 * @dev Backend verifies World ID proof, then calls markVerified()
 */
contract HumanRegistry {
    
    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Mapping of verified addresses
    mapping(address => bool) public verified;
    
    /// @notice Admin address (backend relayer)
    address public admin;
    
    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event UserVerified(address indexed user, uint256 timestamp);
    
    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor(address _admin) {
        admin = _admin;
    }
    
    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Mark a user as verified
     * @param user Address to verify
     * @dev Called by backend after World ID proof verification
     */
    function markVerified(address user) external onlyAdmin {
        verified[user] = true;
        emit UserVerified(user, block.timestamp);
    }
    
    /**
     * @notice Check if user is verified
     * @param user Address to check
     * @return bool True if verified
     */
    function isVerified(address user) external view returns (bool) {
        return verified[user];
    }
    
    /**
     * @notice Update admin address
     * @param newAdmin New admin address
     */
    function updateAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
}
