import { ethers } from 'ethers';
import dotenv from 'dotenv';
import * as ContentRegistryArtifact from '../../contract/out/ContentRegistry.sol/ContentRegistry.json';

dotenv.config();

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      throw new Error('Missing blockchain configuration in environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      contractAddress,
      ContentRegistryArtifact.abi,
      this.wallet
    );
  }

  async registerContent(
    contentHash: string,
    metadataURI: string,
    sources: string[],
    percentages: number[]
  ) {
    try {
      const tx = await this.contract.registerContent(
        contentHash,
        metadataURI,
        sources,
        percentages
      );
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error('Blockchain registration error:', error);
      throw error;
    }
  }

  async getContent(contentId: number) {
    return await this.contract.contents(contentId);
  }
}

export const blockchainService = new BlockchainService();
