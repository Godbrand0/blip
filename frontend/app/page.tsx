"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { useIntents, useOnChainHistory } from "@/hooks/useIntents";
import Link from "next/link";
import { Wallet, History, ArrowRightLeft, Sparkles, TrendingUp, Link as LinkIcon, Loader2 } from "lucide-react";
import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/contexts/AuthContext";
import { motion } from "framer-motion";
import { useReadContract } from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { useEffect, useState } from "react";

import { USDC_ADDRESS, BASE_SEPOLIA_USDC, CHAIN_CONFIGS } from "@/src/config/contracts";
import { worldchainSepolia } from "@/wagmi-config";
import { baseSepolia } from "wagmi/chains"; // Import baseSepolia
import { useBalance } from "wagmi";
import { createPublicClient, http, fallback } from "viem"; // Import viem utils

// Custom public clients backed by reliable RPCs
const wcPublicClient = createPublicClient({
  chain: worldchainSepolia,
  transport: fallback([
    http("https://worldchain-sepolia.drpc.org"),
    http("https://worldchain-sepolia.gateway.tenderly.co"),
    http("https://4801.rpc.thirdweb.com"),
    http("https://worldchain-sepolia.g.alchemy.com/public"),
  ]),
});

const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback([
    http("https://sepolia.base.org"),
    http("https://base-sepolia.drpc.org"),
    http("https://base-sepolia.gateway.tenderly.co"),
  ]),
});

export default function HomePage() {
  const { walletAddress } = useAuth();
  const { intents } = useIntents(walletAddress);
  const { records: onChainRecords } = useOnChainHistory(walletAddress);
  // On-chain records are the source of truth; fall back to Zustand cache while chain loads
  const displayHistory = onChainRecords.length > 0 ? onChainRecords : intents;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  // Fetch USDC balances using reliable RPC clients
  const [worldUsdcBal, setWorldUsdcBal] = useState<bigint>(BigInt(0));
  const [baseUsdcBal, setBaseUsdcBal] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (!walletAddress) return;
    const fetchUsdc = async () => {
      try {
        const [wBal, bBal] = await Promise.all([
          wcPublicClient.readContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          }),
          basePublicClient.readContract({
            address: BASE_SEPOLIA_USDC as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          }),
        ]);
        setWorldUsdcBal(wBal as bigint);
        setBaseUsdcBal(bBal as bigint);
      } catch (e) {
        console.error("Dashboard USDC balance fetch error:", e);
      }
    };
    fetchUsdc();
    const id = setInterval(fetchUsdc, 10000);
    return () => clearInterval(id);
  }, [walletAddress]);

  // Fetch native balances using specialized RPC clients
  const [worldNativeBal, setWorldNativeBal] = useState<bigint>(BigInt(0));
  const [baseNativeBal, setBaseNativeBal] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (!walletAddress) return;
    const fetchNative = async () => {
      try {
        const [wBal, bBal] = await Promise.all([
          wcPublicClient.getBalance({ address: walletAddress as `0x${string}` }),
          basePublicClient.getBalance({ address: walletAddress as `0x${string}` }),
        ]);
        setWorldNativeBal(wBal);
        setBaseNativeBal(bBal);
      } catch (e) {
        console.error("Dashboard native balance fetch error:", e);
      }
    };
    fetchNative();
    const id = setInterval(fetchNative, 10000);
    return () => clearInterval(id);
  }, [walletAddress]);

  const worldBalRaw = parseFloat(formatUnits(worldUsdcBal, 6));
  const baseBalRaw = parseFloat(formatUnits(baseUsdcBal, 6));
  
  const formattedWorldBal = !mounted || isNaN(worldBalRaw) ? "0.00" : worldBalRaw.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const formattedBaseBal = !mounted || isNaN(baseBalRaw) ? "0.00" : baseBalRaw.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalUsdcVal = (worldBalRaw + baseBalRaw).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const rawWorldNative = parseFloat(formatUnits(worldNativeBal, 18));
  const rawBaseNative = parseFloat(formatUnits(baseNativeBal, 18));

  const formattedWorldNative = mounted && !isNaN(rawWorldNative) ? rawWorldNative.toFixed(4) : "0.0000";
  const formattedBaseNative = mounted && !isNaN(rawBaseNative) ? rawBaseNative.toFixed(4) : "0.0000";

  const handleAddToken = async (chainId: number) => {
    if (!(window as any).ethereum) return;
    const config = CHAIN_CONFIGS[chainId];
    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: config.usdc,
            symbol: 'USDC',
            decimals: 6,
          },
        },
      });
    } catch (e) {
      console.error('[CCTP] Error adding token:', e);
    }
  };

  return (
    <AuthGate>
      <div className="min-h-[100dvh] w-full bg-black text-white selection:bg-indigo-500/30">
        {/* Background Gradients */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/5 rounded-full blur-[120px]" />
        </div>

        <main className="relative z-10 max-w-lg mx-auto flex flex-col p-6 pb-32">
          {/* Header */}
          <header className="flex items-center justify-between mb-8 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <img src="/logo.svg" alt="Blip Logo" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">Blip</h1>
            </div>
            <div className="px-4 py-2 glass-panel rounded-full flex items-center gap-2 border border-glass-border">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connecting...'}
              </span>
            </div>
          </header>

          {/* Balance Card */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 mb-8 relative overflow-hidden premium-glow"
          >
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Total Net Worth (USDC)</p>
                <h2 className="text-5xl font-black tracking-tighter">${totalUsdcVal}</h2>
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-start gap-2 group relative">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">World Chain</span>
                    <button 
                      onClick={() => handleAddToken(4801)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 p-1 rounded-md text-[8px] font-black uppercase tracking-widest"
                    >
                      + Wallet
                    </button>
                  </div>
                  <p className="text-lg font-black">${formattedWorldBal}</p>
                  <div className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {formattedWorldNative} ETH
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-start gap-2 group relative">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Base Sepolia</span>
                    <button 
                      onClick={() => handleAddToken(84532)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 p-1 rounded-md text-[8px] font-black uppercase tracking-widest"
                    >
                      + Wallet
                    </button>
                  </div>
                  <p className="text-lg font-black">${formattedBaseBal}</p>
                  <div className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {formattedBaseNative} ETH
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-95 group">
                  <Wallet size={16} className="text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Deposit</span>
                </button>
                <Link href="/bridge" className="flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl transition-all active:scale-95 group">
                  <ArrowRightLeft size={16} className="text-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Bridge</span>
                </Link>
              </div>
            </div>
          </motion.section>

          {/* Transaction History */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                <History size={14} />
                Recent History
              </h3>
              <button className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">View All</button>
            </div>

            <div className="space-y-3">
              {displayHistory.length === 0 ? (
                <div className="glass-card p-10 flex flex-col items-center text-center space-y-4 border-dashed">
                  <div className="w-12 h-12 bg-glass-hover rounded-full flex items-center justify-center">
                    <LinkIcon size={20} className="text-zinc-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">No cross-chain transfers yet.</p>
                </div>
              ) : (
                displayHistory.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="glass-card p-5 group hover:bg-glass-hover transition-all space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          item.status === 'COMPLETED' ? 'bg-green-500/10' : 'bg-indigo-500/10'
                        }`}>
                          <ArrowRightLeft size={20} className={item.status === 'COMPLETED' ? 'text-green-500' : 'text-indigo-500'} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black">{item.amount} USDC</h4>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">World → Base</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                          item.status === 'COMPLETED'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-indigo-500/10 text-indigo-500 animate-pulse'
                        }`}>
                          {item.status}
                        </span>
                        <p className="text-[10px] text-zinc-600 mt-2 font-mono">{item.recipient.slice(0, 6)}...{item.recipient.slice(-4)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-glass-border">
                      {((item as any).sourceTxHash || (item as any).burnTxHash) && (
                        <a 
                          href={`https://worldchain-sepolia.explorer.alchemy.com/tx/${(item as any).sourceTxHash || (item as any).burnTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-indigo-400"
                        >
                          <LinkIcon size={12} />
                          Source Tx
                        </a>
                      )}
                      {(item.status === 'COMPLETED' || (item as any).destTxHash || (item as any).baseTxHash) && ((item as any).destTxHash || (item as any).baseTxHash) && (
                        <a 
                          href={`https://sepolia.basescan.org/tx/${(item as any).destTxHash || (item as any).baseTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-green-400"
                        >
                          <LinkIcon size={12} />
                          Dest Tx
                        </a>
                      )}
                      {item.status !== 'COMPLETED' && !(item as any).destTxHash && !(item as any).baseTxHash && (
                        <div className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white/5 rounded-xl opacity-50 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                          <Loader2 size={12} className="animate-spin" />
                          Relaying...
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          {/* Assistant Floating Component */}
          <ChatInterface />
        </main>
      </div>
    </AuthGate>
  );
}
