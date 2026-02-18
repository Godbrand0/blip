import { ethers } from "ethers";
import dotenv from "dotenv";

// Blockchain configuration is handled via environment variables
dotenv.config();

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || "http://localhost:8545";
    const privateKey = process.env.PRIVATE_KEY;

    console.log('BlockchainService initialization (Bridging Mode):');
    console.log('- RPC URL:', rpcUrl);
    console.log('- Private Key:', privateKey ? 'SET' : 'NOT SET');

    if (!privateKey) {
      console.error('Missing required environment variable: PRIVATE_KEY');
      throw new Error("Missing blockchain configuration");
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  // Bridge specific methods will be added here
  async getWalletBalance() {
    return await this.provider.getBalance(this.wallet.address);
  }
}

export const blockchainService = new BlockchainService();
