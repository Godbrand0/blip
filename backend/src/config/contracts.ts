// src/config/contracts.ts

export const CONTRACTS = {
  HUMAN_REGISTRY: {
    address: process.env.HUMAN_REGISTRY_ADDRESS!,
    abi: [
      "function markVerified(address user) external",
      "function isVerified(address user) view returns (bool)"
    ]
  },
  EXECUTION_VAULT: {
    address: process.env.EXECUTION_VAULT_ADDRESS!,
    abi: [
      "event IntentCreated(uint256 indexed intentId, address indexed user, uint256 amount, address recipient, uint64 destinationChainSelector, bytes32 ccipMessageId, uint256 timestamp)",
      "event IntentExecuted(uint256 indexed intentId, bytes32 indexed ccipMessageId, uint256 timestamp)",
      "function markExecuted(uint256 intentId) external",
      "function getIntent(uint256 intentId) view returns (tuple(address user, uint256 amount, address recipient, uint64 destinationChainSelector, bytes32 ccipMessageId, bool executed, uint256 timestamp))"
    ]
  }
} as const;
