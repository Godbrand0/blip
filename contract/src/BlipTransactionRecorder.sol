// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BlipTransactionRecorder
 * @notice Modernized registry for all bridge transactions initiated through Blip
 * @dev Records bridge intents and their fulfillment statuses on-chain.
 */
contract BlipTransactionRecorder {
    
    // ═══════════════════════════════════════════════════════════
    // TYPE DEFINITIONS
    // ═══════════════════════════════════════════════════════════
    
    enum Status { PENDING, RELAYING, COMPLETED, FAILED }

    struct Transaction {
        uint256 id;
        address user;
        uint256 amount;            // USDC amount (6 decimals)
        address recipient;         // Destination address
        bytes32 sourceTxHash;      // World Chain deposit hash
        bytes32 destTxHash;        // Destination chain relay hash
        Status status;
        uint256 createdAt;         // Timestamp of recording
        uint256 completedAt;       // Timestamp of completion
    }

    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════

    address public owner;
    address public relayer;
    uint256 public nextId;

    /// @notice id => Transaction details
    mapping(uint256 => Transaction) public transactions;
    
    /// @notice user address => list of transaction IDs
    mapping(address => uint256[]) private userTransactionIds;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event TransactionRecorded(
        uint256 indexed id,
        address indexed user,
        uint256 amount,
        address recipient,
        bytes32 sourceTxHash,
        uint256 timestamp
    );

    event StatusUpdated(
        uint256 indexed id,
        Status status,
        bytes32 destTxHash,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == owner, "Not authorized");
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor(address _relayer) {
        owner = msg.sender;
        relayer = _relayer;
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Record a new bridge transaction
     * @param user The address initiating the bridge
     * @param amount The amount of USDC being bridged
     * @param recipient The recipient address on the destination chain
     * @param sourceTxHash The transaction hash on the source chain (World Chain Sepolia)
     */
    function recordTransaction(
        address user,
        uint256 amount,
        address recipient,
        bytes32 sourceTxHash
    ) external returns (uint256 id) {
        id = nextId++;
        transactions[id] = Transaction({
            id: id,
            user: user,
            amount: amount,
            recipient: recipient,
            sourceTxHash: sourceTxHash,
            destTxHash: bytes32(0),
            status: Status.PENDING,
            createdAt: block.timestamp,
            completedAt: 0
        });

        userTransactionIds[user].push(id);

        emit TransactionRecorded(id, user, amount, recipient, sourceTxHash, block.timestamp);
    }

    /**
     * @notice Update the status of a recorded transaction
     * @param id The transaction ID
     * @param status The new status
     * @param destTxHash The transaction hash on the destination chain (optional, pass 0 if none)
     */
    function updateStatus(
        uint256 id,
        Status status,
        bytes32 destTxHash
    ) external onlyRelayer {
        require(id < nextId, "Invalid ID");
        Transaction storage txn = transactions[id];
        txn.status = status;
        txn.destTxHash = destTxHash;
        
        if (status == Status.COMPLETED) {
            txn.completedAt = block.timestamp;
        }

        emit StatusUpdated(id, status, destTxHash, block.timestamp);
    }

    /**
     * @notice Fetch all transactions for a specific user
     * @param user The user address
     */
    function getUserTransactions(address user) external view returns (Transaction[] memory) {
        uint256[] storage ids = userTransactionIds[user];
        Transaction[] memory result = new Transaction[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = transactions[ids[i]];
        }
        return result;
    }

    /**
     * @notice Update the relayer address
     * @param _relayer New relayer address
     */
    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    /**
     * @notice Transfer contract ownership
     * @param _owner New owner address
     */
    function transferOwnership(address _owner) external onlyOwner {
        owner = _owner;
    }
}
