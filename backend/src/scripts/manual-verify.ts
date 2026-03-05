import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(__dirname, '../../.env') });

const CONTRACTS = {
  HUMAN_REGISTRY: {
    address: process.env.HUMAN_REGISTRY_ADDRESS!,
    abi: [
      "function markVerified(address user) external",
      "function isVerified(address user) view returns (bool)"
    ]
  }
};

async function main() {
  const addressToVerify = process.argv[2];
  if (!addressToVerify) {
    console.error("Please provide an address to verify");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.WORLD_CHAIN_RPC);
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("DEPLOYER_PRIVATE_KEY not found in .env");
    process.exit(1);
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  const registry = new ethers.Contract(
    CONTRACTS.HUMAN_REGISTRY.address,
    CONTRACTS.HUMAN_REGISTRY.abi,
    wallet
  );

  console.log(`Verifying ${addressToVerify} on-chain...`);
  try {
    const tx = await registry.markVerified(addressToVerify);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`Success! ${addressToVerify} is now verified.`);
  } catch (error) {
    console.error("Failed to verify address:", error);
  }
}

main();
