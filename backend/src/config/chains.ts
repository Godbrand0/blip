// src/config/chains.ts

export const CHAINS = {
  WORLD_CHAIN: {
    name: "World Chain Testnet",
    chainId: 4801,
    rpcUrl: process.env.WORLD_CHAIN_RPC!,
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    tokenMessenger: process.env.WORLD_CHAIN_TOKEN_MESSENGER!,
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275", // World Chain Sepolia MessageTransmitter (CCTP V2)
    usdcToken: process.env.WORLD_CHAIN_USDC!,
    domain: parseInt(process.env.WORLD_CHAIN_DOMAIN || "14")
  },
  BASE_SEPOLIA: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC!,
    explorer: "https://sepolia.basescan.org",
    tokenMessenger: "0x9f3f620bd14e4b6009ed098696d744a56a644837",
    messageTransmitter: process.env.BASE_SEPOLIA_MESSAGE_TRANSMITTER!,
    usdcToken: process.env.BASE_SEPOLIA_USDC!,
    domain: parseInt(process.env.BASE_SEPOLIA_DOMAIN || "6")
  }
} as const;
