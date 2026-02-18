// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CCIPExecutionVault
 * @notice Locks USDC and triggers CCIP cross-chain transfers
 * @dev Integrates with Chainlink CCIP for trustless bridging
 */
contract CCIPExecutionVault {
    
    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Chainlink CCIP Router
    IRouterClient public immutable ccipRouter;
    
    /// @notice LINK token for CCIP fees
    IERC20 public immutable linkToken;
    
    /// @notice USDC token
    IERC20 public immutable usdcToken;
    
    /// @notice HumanRegistry contract
    address public immutable humanRegistry;
    
    /// @notice Admin address (CRE backend)
    address public admin;
    
    /// @notice Intent counter
    uint256 public intentCounter;
    
    /// @notice Intent data structure
    struct Intent {
        address user;
        uint256 amount;
        address recipient;
        uint64 destinationChainSelector;
        bytes32 ccipMessageId;
        bool executed;
        uint256 timestamp;
    }
    
    /// @notice Mapping of intent ID to Intent
    mapping(uint256 => Intent) public intents;
    
    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event IntentCreated(
        uint256 indexed intentId,
        address indexed user,
        uint256 amount,
        address recipient,
        uint64 destinationChainSelector,
        bytes32 ccipMessageId,
        uint256 timestamp
    );
    
    event IntentExecuted(
        uint256 indexed intentId,
        bytes32 indexed ccipMessageId,
        uint256 timestamp
    );
    
    event LinkFunded(
        address indexed funder,
        uint256 amount,
        uint256 timestamp
    );
    
    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════
    
    error NotVerifiedHuman();
    error InsufficientLinkForFees(uint256 required, uint256 available);
    error USDCTransferFailed();
    error IntentAlreadyExecuted(uint256 intentId);
    error OnlyAdmin();
    
    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════
    
    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    function _onlyAdmin() internal view {
        if (msg.sender != admin) revert OnlyAdmin();
    }
    
    modifier onlyVerifiedHuman() {
        _checkVerifiedHuman();
        _;
    }

    function _checkVerifiedHuman() internal view {
        if (!IHumanRegistry(humanRegistry).isVerified(msg.sender)) {
            revert NotVerifiedHuman();
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor(
        address _ccipRouter,
        address _linkToken,
        address _usdcToken,
        address _humanRegistry,
        address _admin
    ) {
        ccipRouter = IRouterClient(_ccipRouter);
        linkToken = IERC20(_linkToken);
        usdcToken = IERC20(_usdcToken);
        humanRegistry = _humanRegistry;
        admin = _admin;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CORE FUNCTION: CREATE INTENT + TRIGGER CCIP
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Create intent and trigger CCIP transfer
     * @param amount USDC amount (6 decimals)
     * @param recipient Address on destination chain
     * @param destinationChainSelector CCIP chain selector
     * @return intentId The ID of created intent
     * @return messageId CCIP message ID for tracking
     */
    function createIntent(
        uint256 amount,
        address recipient,
        uint64 destinationChainSelector
    ) 
        external 
        onlyVerifiedHuman
        returns (uint256 intentId, bytes32 messageId) 
    {
        return _executeBridge(msg.sender, amount, recipient, destinationChainSelector);
    }
    
    /**
     * @notice Delegated execution of bridge intent by CRE admin
     * @param user The address of the user initiating the bridge
     * @param amount USDC amount
     * @param recipient Recipient on destination chain
     * @param destinationChainSelector CCIP chain selector
     */
    function executeBridgeForUser(
        address user,
        uint256 amount,
        address recipient,
        uint64 destinationChainSelector
    ) 
        external 
        onlyAdmin 
        returns (uint256 intentId, bytes32 messageId) 
    {
        if (!IHumanRegistry(humanRegistry).isVerified(user)) {
            revert NotVerifiedHuman();
        }
        return _executeBridge(user, amount, recipient, destinationChainSelector);
    }

    /**
     * @dev Internal bridging logic
     */
    function _executeBridge(
        address user,
        uint256 amount,
        address recipient,
        uint64 destinationChainSelector
    ) 
        internal 
        returns (uint256 intentId, bytes32 messageId) 
    {
        
        // ───────────────────────────────────────────────────────
        // STEP 1: TRANSFER USDC FROM USER (MUST BE PRE-APPROVED)
        // ───────────────────────────────────────────────────────
        
        bool success = usdcToken.transferFrom(
            user, 
            address(this), 
            amount
        );
        
        if (!success) revert USDCTransferFailed();
        
        // ───────────────────────────────────────────────────────
        // STEP 2: APPROVE CCIP ROUTER TO SPEND USDC
        // ───────────────────────────────────────────────────────
        
        usdcToken.approve(address(ccipRouter), amount);
        
        // ───────────────────────────────────────────────────────
        // STEP 3: BUILD CCIP MESSAGE
        // ───────────────────────────────────────────────────────
        
        // Token amounts array
        Client.EVMTokenAmount[] memory tokenAmounts = 
            new Client.EVMTokenAmount[](1);
        
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(usdcToken),
            amount: amount
        });
        
        // Build CCIP message
        Client.EVM2AnyMessage memory ccipMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(recipient),
            data: "",
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV2({
                    gasLimit: 0, // No contract call on destination
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(linkToken)
        });
        
        // ───────────────────────────────────────────────────────
        // STEP 4: GET CCIP FEE
        // ───────────────────────────────────────────────────────
        
        uint256 ccipFee = ccipRouter.getFee(
            destinationChainSelector,
            ccipMessage
        );
        
        // Check LINK balance
        uint256 linkBalance = linkToken.balanceOf(address(this));
        
        if (linkBalance < ccipFee) {
            revert InsufficientLinkForFees(ccipFee, linkBalance);
        }
        
        // ───────────────────────────────────────────────────────
        // STEP 5: APPROVE LINK FOR FEES
        // ───────────────────────────────────────────────────────
        
        linkToken.approve(address(ccipRouter), ccipFee);
        
        // ───────────────────────────────────────────────────────
        // STEP 6: SEND VIA CCIP
        // ───────────────────────────────────────────────────────
        
        messageId = ccipRouter.ccipSend(
            destinationChainSelector,
            ccipMessage
        );
        
        // ───────────────────────────────────────────────────────
        // STEP 7: STORE INTENT
        // ───────────────────────────────────────────────────────
        
        intentId = intentCounter++;
        
        intents[intentId] = Intent({
            user: user,
            amount: amount,
            recipient: recipient,
            destinationChainSelector: destinationChainSelector,
            ccipMessageId: messageId,
            executed: false,
            timestamp: block.timestamp
        });
        
        // ───────────────────────────────────────────────────────
        // STEP 8: EMIT EVENT
        // ───────────────────────────────────────────────────────
        
        emit IntentCreated(
            intentId,
            user,
            amount,
            recipient,
            destinationChainSelector,
            messageId,
            block.timestamp
        );
        
        return (intentId, messageId);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CRE CALLS AFTER VERIFYING CCIP SUCCESS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Mark intent as executed
     * @param intentId Intent ID to mark
     * @dev Called by CRE after confirming CCIP delivery
     */
    function markExecuted(uint256 intentId) external onlyAdmin {
        
        if (intents[intentId].executed) {
            revert IntentAlreadyExecuted(intentId);
        }
        
        intents[intentId].executed = true;
        
        emit IntentExecuted(
            intentId,
            intents[intentId].ccipMessageId,
            block.timestamp
        );
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Fund contract with LINK for CCIP fees
     * @param amount LINK amount to deposit
     */
    function fundLink(uint256 amount) external {
        bool success = linkToken.transferFrom(msg.sender, address(this), amount);
        require(success, "LINK transfer failed");
        emit LinkFunded(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @notice Get LINK balance
     * @return uint256 LINK balance
     */
    function getLinkBalance() external view returns (uint256) {
        return linkToken.balanceOf(address(this));
    }
    
    /**
     * @notice Get intent details
     * @param intentId Intent ID
     * @return Intent struct
     */
    function getIntent(uint256 intentId) 
        external 
        view 
        returns (Intent memory) 
    {
        return intents[intentId];
    }
    
    /**
     * @notice Update admin
     * @param newAdmin New admin address
     */
    function updateAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
}

// ═══════════════════════════════════════════════════════════
// INTERFACE
// ═══════════════════════════════════════════════════════════

interface IHumanRegistry {
    function isVerified(address user) external view returns (bool);
}
