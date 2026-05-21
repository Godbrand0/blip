// src/config/chains.ts

// CCTP V2 contracts are deployed at the same address on all testnets
const CCTP_V2_TESTNET_TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
const CCTP_V2_TESTNET_MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";

export const CHAINS = {
  WORLD_CHAIN: {
    name: "World Chain Testnet",
    chainId: 4801,
    rpcUrl: process.env.WORLD_CHAIN_RPC || "https://worldchain-sepolia.drpc.org",
    rpcFallbacks: [
      "https://worldchain-sepolia.drpc.org",
      "https://worldchain-sepolia.gateway.tenderly.co",
      "https://4801.rpc.thirdweb.com",
    ],
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    tokenMessenger: process.env.WORLD_CHAIN_TOKEN_MESSENGER || CCTP_V2_TESTNET_TOKEN_MESSENGER,
    messageTransmitter: process.env.WORLD_CHAIN_MESSAGE_TRANSMITTER || CCTP_V2_TESTNET_MESSAGE_TRANSMITTER,
    usdcToken: process.env.WORLD_CHAIN_USDC || "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
    domain: parseInt(process.env.WORLD_CHAIN_DOMAIN || "14")
  },
  BASE_SEPOLIA: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC || "https://sepolia.base.org",
    rpcFallbacks: [
      "https://sepolia.base.org",
      "https://base-sepolia.drpc.org",
      "https://base-sepolia.gateway.tenderly.co",
    ],
    explorer: "https://sepolia.basescan.org",
    tokenMessenger: process.env.BASE_SEPOLIA_TOKEN_MESSENGER || CCTP_V2_TESTNET_TOKEN_MESSENGER,
    messageTransmitter: process.env.BASE_SEPOLIA_MESSAGE_TRANSMITTER || CCTP_V2_TESTNET_MESSAGE_TRANSMITTER,
    usdcToken: process.env.BASE_SEPOLIA_USDC || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    domain: parseInt(process.env.BASE_SEPOLIA_DOMAIN || "6")
  },
  MONAD_TESTNET: {
    name: "Monad Testnet",
    chainId: 10143,
    rpcUrl: process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz",
    rpcFallbacks: [
      "https://testnet-rpc.monad.xyz",
      "https://rpc.ankr.com/monad_testnet",
    ],
    explorer: "https://testnet.monadexplorer.com",
    tokenMessenger: CCTP_V2_TESTNET_TOKEN_MESSENGER,
    messageTransmitter: CCTP_V2_TESTNET_MESSAGE_TRANSMITTER,
    usdcToken: process.env.MONAD_USDC || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    domain: 15
  },
  ARC_TESTNET: {
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: process.env.ARC_RPC || "https://rpc.testnet.arc.network",
    rpcFallbacks: [
      "https://rpc.testnet.arc.network",
    ],
    explorer: "https://testnet.arcscan.app",
    tokenMessenger: CCTP_V2_TESTNET_TOKEN_MESSENGER,
    messageTransmitter: CCTP_V2_TESTNET_MESSAGE_TRANSMITTER,
    usdcToken: process.env.ARC_USDC || "0x3600000000000000000000000000000000000000",
    domain: 26
  }
};
