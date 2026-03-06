import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const user = '0x6dC4F7e7dC254777B8301eF3f89dD7757740c5f7';
const usdc = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function check() {
  const bal = await client.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [user],
  });
  console.log('Balance:', formatUnits(bal, 6));
}

check();
