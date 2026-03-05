// src/config/contracts.ts

export const CONTRACTS = {
  HUMAN_REGISTRY: {
    address: process.env.HUMAN_REGISTRY_ADDRESS!,
    abi: [
      "function markVerified(address user) external",
      "function isVerified(address user) view returns (bool)"
    ]
  },
  TRANSACTION_RECORDER: {
    address: process.env.TRANSACTION_RECORDER_ADDRESS!,
    abi: [
      "function recordTransaction(address user, uint256 amount, address recipient, bytes32 sourceTxHash) external returns (uint256 id)",
      "function updateStatus(uint256 id, uint8 status, bytes32 destTxHash) external",
      "function getUserTransactions(address user) view returns (tuple(uint256 id, address user, uint256 amount, address recipient, bytes32 sourceTxHash, bytes32 destTxHash, uint8 status, uint256 createdAt, uint256 completedAt)[])",
      "event TransactionRecorded(uint256 indexed id, address indexed user, uint256 amount, address recipient, bytes32 sourceTxHash, uint256 timestamp)",
      "event StatusUpdated(uint256 indexed id, uint8 status, bytes32 destTxHash, uint256 timestamp)"
    ]
  }
} as const;
