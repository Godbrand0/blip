// Contract addresses and ABIs for frontend usage
// USDC on World Chain
export const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x79A02482A880bCE3B13e09Da970dC34db4CD24d1"; // World Chain USDC

// CCIPExecutionVault deployed address
export const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x";

// Base chain selector for CCIP
export const BASE_CHAIN_SELECTOR = "15971525489660198786";

// Minimal ABIs for MiniKit sendTransaction
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const VAULT_ABI = [
  {
    name: "createIntent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "destinationChainSelector", type: "uint64" },
    ],
    outputs: [
      { name: "intentId", type: "uint256" },
      { name: "messageId", type: "bytes32" },
    ],
  },
] as const;
