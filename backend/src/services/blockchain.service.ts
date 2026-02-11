import { ethers } from "ethers";
import path from "path";
import { readFileSync } from "fs";
import dotenv from "dotenv";

const contractOutDir = path.resolve(__dirname, "../../../contract/out");
const ContentRegistryArtifact = JSON.parse(
  readFileSync(path.join(contractOutDir, "ContentRegistry.sol/ContentRegistry.json"), "utf-8")
);
const RoyaltyPayoutArtifact = JSON.parse(
  readFileSync(path.join(contractOutDir, "RoyaltyPayout.sol/RoyaltyPayout.json"), "utf-8")
);

dotenv.config();

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contentRegistry: ethers.Contract;
  private royaltyPayout: ethers.Contract | undefined;

  constructor() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || "http://localhost:8545";
    const privateKey = process.env.PRIVATE_KEY;
    const contentRegistryAddress = process.env.CONTENT_REGISTRY_ADDRESS;
    const royaltyPayoutAddress = process.env.ROYALTY_PAYOUT_ADDRESS;

    if (!privateKey || !contentRegistryAddress) {
      throw new Error(
        "Missing blockchain configuration in environment variables",
      );
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contentRegistry = new ethers.Contract(
      contentRegistryAddress,
      ContentRegistryArtifact.abi,
      this.wallet,
    );

    if (royaltyPayoutAddress) {
      this.royaltyPayout = new ethers.Contract(
        royaltyPayoutAddress,
        RoyaltyPayoutArtifact.abi,
        this.wallet,
      );
    }
  }

  async registerContent(
    contentHash: string,
    metadataURI: string,
    sources: string[],
    percentages: number[],
  ) {
    try {
      const tx = await this.contentRegistry.registerContent(
        contentHash,
        metadataURI,
        sources,
        percentages,
      );
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error("Blockchain registration error:", error);
      throw error;
    }
  }

  async getContent(contentId: number) {
    return await this.contentRegistry.contents(contentId);
  }

  async validateContent(contentId: number, isHuman: boolean) {
    try {
      const tx = await this.contentRegistry.validateContent(contentId, isHuman);
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error("Content validation error:", error);
      throw error;
    }
  }

  async distributeRoyalties(contentId: number, amount: string) {
    if (!this.royaltyPayout) {
      throw new Error("RoyaltyPayout contract not initialized");
    }

    try {
      const tx = await this.royaltyPayout.distributeRoyalties(contentId, {
        value: ethers.parseEther(amount),
      });
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error("Royalty distribution error:", error);
      throw error;
    }
  }
}

export const blockchainService = new BlockchainService();
