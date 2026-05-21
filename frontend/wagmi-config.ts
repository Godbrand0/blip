import { http as httpTransport, fallback } from "viem";
import { defineChain } from "viem";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const worldchainSepolia = defineChain({
  id: 4801,
  name: "World Chain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC || "https://worldchain-sepolia.drpc.org",
        "https://worldchain-sepolia.gateway.tenderly.co",
        "https://4801.rpc.thirdweb.com",
        "https://worldchain-sepolia.g.alchemy.com/public",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "World Chain Explorer",
      url: "https://worldchain-sepolia.explorer.alchemy.com",
    },
  },
});


const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId || projectId === "your_walletconnect_project_id") {
  console.warn(
    "WalletConnect project ID is not configured. Please get a project ID from https://cloud.walletconnect.com/ and add it to your .env.local file as NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  );
}

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://testnet-rpc.monad.xyz",
        "https://rpc.ankr.com/monad_testnet",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "Blip",
  projectId: projectId || "",
  chains: [worldchainSepolia, baseSepolia, monadTestnet, arcTestnet],
  transports: {
    [worldchainSepolia.id]: fallback([
      ...(process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC
        ? [httpTransport(process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC)]
        : []),
      httpTransport("https://worldchain-sepolia.drpc.org"),
      httpTransport("https://worldchain-sepolia.gateway.tenderly.co"),
      httpTransport("https://4801.rpc.thirdweb.com"),
      httpTransport("https://worldchain-sepolia.g.alchemy.com/public"),
    ]),
    [baseSepolia.id]: fallback([
      httpTransport("https://sepolia.base.org"),
      httpTransport("https://base-sepolia.drpc.org"),
      httpTransport("https://base-sepolia.gateway.tenderly.co"),
    ]),
    [monadTestnet.id]: fallback([
      httpTransport("https://testnet-rpc.monad.xyz"),
      httpTransport("https://rpc.ankr.com/monad_testnet"),
    ]),
    [arcTestnet.id]: httpTransport("https://rpc.testnet.arc.network"),
  },
});

