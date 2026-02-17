import { http } from "wagmi";
import { defineChain } from "viem";
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const worldchain = defineChain({
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
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
    "WalletConnect project ID is not configured. Please get a project ID from https://cloud.walletconnect.com/ and add it to your .env.local file as NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
  );
}

export const config = getDefaultConfig({
  appName: "Blip",
  projectId: projectId || "",
  chains: [worldchain, mainnet, polygon, optimism, arbitrum, base, sepolia],
  transports: {
    [worldchain.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
});