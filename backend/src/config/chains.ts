// src/config/chains.ts

export const CHAINS = {
  WORLD_CHAIN: {
    name: "World Chain Testnet",
    chainId: 4801,
    rpcUrl: process.env.WORLD_CHAIN_RPC!,
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    ccipRouter: "0x...", // User needs to provide or I'll look up
    linkToken: "0x...",
    usdcToken: "0x..."
  },
  BASE: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC!,
    explorer: "https://sepolia.basescan.org",
    chainSelector: "10344971235874465080", // CCIP chain selector
    ccipRouter: "0x...",
    usdcToken: "0x..."
  }
} as const;
