// src/config/contracts.ts

// Import full ABIs from JSON files
import CCIPExecutionVaultABI from '../abis/CCIPExecutionVault.json';

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
    abi: CCIPExecutionVaultABI
  }
} as const;
