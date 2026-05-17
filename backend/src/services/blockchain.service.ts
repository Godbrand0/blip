import { ethers } from "ethers";
import { CHAINS } from "../config/chains";
import dotenv from "dotenv";

// Blockchain configuration is handled via environment variables
dotenv.config();

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor() {
    const crePrivateKey = process.env.RELAYER_PRIVATE_KEY;

    console.log('BlockchainService initialization (Bridging Mode):');
    console.log('- World Chain RPC:', CHAINS.WORLD_CHAIN.rpcUrl);
    console.log('- CRE Private Key:', crePrivateKey ? 'SET' : 'NOT SET');

    if (!crePrivateKey) {
      console.error('Missing required environment variable: RELAYER_PRIVATE_KEY');
      throw new Error("Missing blockchain configuration");
    }

    this.provider = new ethers.JsonRpcProvider(CHAINS.WORLD_CHAIN.rpcUrl, {
      chainId: CHAINS.WORLD_CHAIN.chainId,
      name: CHAINS.WORLD_CHAIN.name
    }, { staticNetwork: true });
    this.wallet = new ethers.Wallet(crePrivateKey, this.provider);
  }

  // Bridge specific methods will be added here
  async getWalletBalance() {
    return await this.provider.getBalance(this.wallet.address);
  }
}

export const blockchainService = new BlockchainService();
