// src/config/chains.ts

export const CHAINS = {
  WORLD_CHAIN: {
    name: "World Chain Testnet",
    chainId: 4801,
    rpcUrl: process.env.WORLD_CHAIN_RPC!,
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    tokenMessenger: process.env.WORLD_CHAIN_TOKEN_MESSENGER!,
    messageTransmitter: process.env.WORLD_CHAIN_MESSAGE_TRANSMITTER!,
    usdcToken: process.env.WORLD_CHAIN_USDC!,
    domain: parseInt(process.env.WORLD_CHAIN_DOMAIN || "14")
  },
  BASE_SEPOLIA: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC!,
    explorer: "https://sepolia.basescan.org",
    tokenMessenger: process.env.BASE_SEPOLIA_TOKEN_MESSENGER!,
    messageTransmitter: process.env.BASE_SEPOLIA_MESSAGE_TRANSMITTER!,
    usdcToken: process.env.BASE_SEPOLIA_USDC!,
    domain: parseInt(process.env.BASE_SEPOLIA_DOMAIN || "6")
  }
} as const;
