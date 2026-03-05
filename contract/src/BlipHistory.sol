// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BlipHistory
 * @notice On-chain registry of all CCTP bridge transactions initiated through Blip
 * @dev User calls recordBridge() immediately after depositForBurn() succeeds.
 *      Backend relayer calls updateStatus() after successful mint on Base Sepolia.
 */
contract BlipHistory {

    // ═══════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════

    enum Status { PENDING, RELAYING, COMPLETED, FAILED }

    struct BridgeRecord {
        uint256 recordId;
        address user;
        uint256 amount;            // USDC amount in 6-decimal raw units
        address recipient;         // Recipient on Base Sepolia
        uint32  destinationDomain; // Circle domain (6 = Base Sepolia)
        bytes32 burnTxHash;        // World Chain depositForBurn tx hash
        bytes32 relayTxHash;       // Base Sepolia receiveMessage tx hash (zero until set)
        Status  status;
        uint256 createdAt;         // block.timestamp at record creation
        uint256 completedAt;       // block.timestamp when COMPLETED (0 otherwise)
    }

    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════

    /// @notice Owner address (can set relayer)
    address public owner;

    /// @notice Relayer address (backend CRE hot wallet)
    address public relayer;

    /// @notice Total records created
    uint256 public recordCount;

    /// @notice recordId => BridgeRecord
    mapping(uint256 => BridgeRecord) public records;

    /// @notice user address => list of their recordIds
    mapping(address => uint256[]) private userRecords;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event BridgeRecorded(
        uint256 indexed recordId,
        address indexed user,
        uint256 amount,
        address recipient,
        bytes32 burnTxHash,
        uint256 createdAt
    );

    event StatusUpdated(
        uint256 indexed recordId,
        Status  status,
        bytes32 relayTxHash,
        uint256 updatedAt
    );

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyRelayer() {
        _onlyRelayer();
        _;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyRelayer() internal view {
        require(msg.sender == relayer, "Not relayer");
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner, "Not owner");
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor(address _owner, address _relayer) {
        owner   = _owner;
        relayer = _relayer;
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Record a new bridge intent on-chain
     * @param user        Address that initiated the bridge
     * @param amount      USDC amount (6 decimals)
     * @param recipient   Recipient address on Base Sepolia
     * @param burnTxHash  Transaction hash of the depositForBurn() call
     * @return recordId   The assigned record ID
     * @dev Callable by the user OR the relayer (allows backend to record on failure recovery)
     */
    function recordBridge(
        address user,
        uint256 amount,
        address recipient,
        bytes32 burnTxHash
    ) external returns (uint256 recordId) {
        require(
            msg.sender == user || msg.sender == relayer,
            "Only user or relayer"
        );

        recordId = recordCount++;

        records[recordId] = BridgeRecord({
            recordId:          recordId,
            user:              user,
            amount:            amount,
            recipient:         recipient,
            destinationDomain: 6,
            burnTxHash:        burnTxHash,
            relayTxHash:       bytes32(0),
            status:            Status.PENDING,
            createdAt:         block.timestamp,
            completedAt:       0
        });

        userRecords[user].push(recordId);

        emit BridgeRecorded(recordId, user, amount, recipient, burnTxHash, block.timestamp);
    }

    /**
     * @notice Update status of an existing record
     * @param recordId    ID of the record to update
     * @param status      New status value
     * @param relayTxHash Destination chain tx hash (pass bytes32(0) if not yet available)
     * @dev Only callable by the relayer (CRE backend hot wallet)
     */
    function updateStatus(
        uint256 recordId,
        Status  status,
        bytes32 relayTxHash
    ) external onlyRelayer {
        require(recordId < recordCount, "Record does not exist");

        BridgeRecord storage r = records[recordId];
        r.status = status;

        if (relayTxHash != bytes32(0)) {
            r.relayTxHash = relayTxHash;
        }

        if (status == Status.COMPLETED) {
            r.completedAt = block.timestamp;
        }

        emit StatusUpdated(recordId, status, relayTxHash, block.timestamp);
    }

    /**
     * @notice Get all records for a given user
     * @param user Address to query
     * @return BridgeRecord[] All records belonging to user (oldest first)
     */
    function getUserRecords(address user)
        external
        view
        returns (BridgeRecord[] memory)
    {
        uint256[] storage ids = userRecords[user];
        BridgeRecord[] memory result = new BridgeRecord[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = records[ids[i]];
        }
        return result;
    }

    /**
     * @notice Get a single record by ID
     * @param recordId Record ID to fetch
     * @return BridgeRecord The record
     */
    function getRecord(uint256 recordId)
        external
        view
        returns (BridgeRecord memory)
    {
        require(recordId < recordCount, "Record does not exist");
        return records[recordId];
    }

    // ═══════════════════════════════════════════════════════════
    // OWNER FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Update the relayer address
     * @param newRelayer New relayer address
     */
    function setRelayer(address newRelayer) external onlyOwner {
        relayer = newRelayer;
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
