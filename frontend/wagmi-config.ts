import { http as httpTransport, fallback } from "viem";
import { defineChain } from "viem";
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia,
} from "wagmi/chains";
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

export const worldchain = defineChain({
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://worldchain-mainnet.g.alchemy.com/public",
        "https://worldchain.drpc.org",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "World Chain Explorer",
      url: "https://worldchain-mainnet.explorer.alchemy.com",
    },
  },
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId || projectId === "your_walletconnect_project_id") {
  console.warn(
    "WalletConnect project ID is not configured. Please get a project ID from https://cloud.walletconnect.com/ and add it to your .env.local file as NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  );
}

export const config = getDefaultConfig({
  appName: "Blip",
  projectId: projectId || "",
  chains: [worldchainSepolia, worldchain, mainnet, polygon, optimism, arbitrum, base, sepolia],
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
    [worldchain.id]: httpTransport(),
    [mainnet.id]: httpTransport(),
    [polygon.id]: httpTransport(),
    [optimism.id]: httpTransport(),
    [arbitrum.id]: httpTransport(),
    [base.id]: httpTransport(),
    [sepolia.id]: httpTransport(),
  },
});

