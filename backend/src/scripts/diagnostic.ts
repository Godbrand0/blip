import { createPublicClient, http, parseAbi, parseUnits, formatUnits } from 'viem';
import { defineChain } from 'viem';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const worldchainSepolia = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://worldchain-sepolia.g.alchemy.com/public'] },
  },
});

const USDC_ADDRESS = '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88';
const TOKEN_MESSENGER_ADDRESS = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS as `0x${string}`;

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

async function main() {
  console.log('--- World Chain Sepolia Diagnostic ---');
  console.log('Deployer Address:', DEPLOYER_ADDRESS);

  const client = createPublicClient({
    chain: worldchainSepolia,
    transport: http(),
  });

  try {
    // 1. Check ETH Balance
    const ethBalance = await client.getBalance({ address: DEPLOYER_ADDRESS });
    console.log('ETH Balance:', formatUnits(ethBalance, 18), 'ETH');

    // 2. Check USDC Balance
    const usdcBalance = await client.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [DEPLOYER_ADDRESS],
    });
    console.log('USDC Balance:', formatUnits(usdcBalance, 6), 'USDC');

    // 3. Check USDC Allowance
    const allowance = await client.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [DEPLOYER_ADDRESS, TOKEN_MESSENGER_ADDRESS as `0x${string}`],
    });
    console.log('USDC Allowance for TokenMessenger:', formatUnits(allowance, 6), 'USDC');

    if (usdcBalance < parseUnits('4', 6)) {
      console.error('CRITICAL: Insufficient USDC balance (Need at least 4 USDC)');
    }
    if (allowance < usdcBalance) {
        console.warn('WARNING: Allowance is less than balance. May need re-approval.');
    }

    // 4. Verify TokenMessenger Existence
    const code = await client.getBytecode({ address: TOKEN_MESSENGER_ADDRESS as `0x${string}` });
    console.log('TokenMessenger Contract Code:', code ? 'Found' : 'NOT FOUND');

  } catch (err: any) {
    console.error('Diagnostic failed:', err.message);
  }
}

main().catch(console.error);
