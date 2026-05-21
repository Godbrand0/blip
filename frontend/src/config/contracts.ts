// CCTP V2 contracts are deployed at the same address on all testnets
const CCTP_V2_TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";

// World Chain Sepolia (Chain ID: 4801)
export const WORLD_CHAIN_USDC = "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88";
export const WORLD_CHAIN_TOKEN_MESSENGER = CCTP_V2_TOKEN_MESSENGER;
export const WORLD_CHAIN_DOMAIN = 14;

// Base Sepolia (Chain ID: 84532)
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BASE_SEPOLIA_TOKEN_MESSENGER = CCTP_V2_TOKEN_MESSENGER;
export const BASE_SEPOLIA_DOMAIN = 6;

// Monad Testnet (Chain ID: 10143)
export const MONAD_TESTNET_USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
export const MONAD_TESTNET_TOKEN_MESSENGER = CCTP_V2_TOKEN_MESSENGER;
export const MONAD_TESTNET_DOMAIN = 15;

// Arc Testnet (Chain ID: 5042002)
export const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
export const ARC_TESTNET_TOKEN_MESSENGER = CCTP_V2_TOKEN_MESSENGER;
export const ARC_TESTNET_DOMAIN = 26;

// Legacy / Default exports for compatibility
export const USDC_ADDRESS = WORLD_CHAIN_USDC;
export const TOKEN_MESSENGER_ADDRESS = WORLD_CHAIN_TOKEN_MESSENGER;

export type ChainConfig = { usdc: string; tokenMessenger: string; domain: number; name: string; explorer: string; backendKey: string };

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  4801: {
    usdc: WORLD_CHAIN_USDC,
    tokenMessenger: WORLD_CHAIN_TOKEN_MESSENGER,
    domain: WORLD_CHAIN_DOMAIN,
    name: "World Chain",
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    backendKey: "WORLD_CHAIN"
  },
  84532: {
    usdc: BASE_SEPOLIA_USDC,
    tokenMessenger: BASE_SEPOLIA_TOKEN_MESSENGER,
    domain: BASE_SEPOLIA_DOMAIN,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    backendKey: "BASE_SEPOLIA"
  },
  10143: {
    usdc: MONAD_TESTNET_USDC,
    tokenMessenger: MONAD_TESTNET_TOKEN_MESSENGER,
    domain: MONAD_TESTNET_DOMAIN,
    name: "Monad Testnet",
    explorer: "https://testnet.monadexplorer.com",
    backendKey: "MONAD_TESTNET"
  },
  5042002: {
    usdc: ARC_TESTNET_USDC,
    tokenMessenger: ARC_TESTNET_TOKEN_MESSENGER,
    domain: ARC_TESTNET_DOMAIN,
    name: "Arc Testnet",
    explorer: "https://testnet.arcscan.app",
    backendKey: "ARC_TESTNET"
  }
};

export const TOKEN_MESSENGER_ABI = [
  {
    name: "depositForBurn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" }
    ],
    outputs: [{ name: "nonce", type: "uint64" }]
  }
] as const;

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

// BlipTransactionRecorder (World Chain Sepolia)
export const TRANSACTION_RECORDER_ADDRESS =
  process.env.NEXT_PUBLIC_TRANSACTION_RECORDER_ADDRESS || "0xfd3957cdcf616f805024491f666a01bd9d835cc4";

export const TRANSACTION_RECORDER_ABI = [
  {
    name: "recordTransaction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "sourceTxHash", type: "bytes32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    name: "getUserTransactions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "user", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "sourceTxHash", type: "bytes32" },
          { name: "destTxHash", type: "bytes32" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "completedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "TransactionRecorded",
    type: "event",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "recipient", type: "address", indexed: false },
      { name: "sourceTxHash", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
