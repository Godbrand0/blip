// src/config/chains.ts

export const CHAINS = {
  WORLD_CHAIN: {
    name: "World Chain Testnet",
    chainId: 4801,
    rpcUrl: process.env.WORLD_CHAIN_RPC!,
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    ccipRouter: "0x4769623838E83D046AeEb099042a98D081916E8d",
    linkToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    usdcToken: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88"
  },
  BASE: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC!,
    explorer: "https://sepolia.basescan.org",
    chainSelector: "10344971235874465080", // CCIP chain selector
    ccipRouter: "0xD3b06143f349118188bD6731Fb330CB44619dED2",
    usdcToken: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }
} as const;
