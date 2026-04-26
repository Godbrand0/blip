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

function formatTime(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  const date = typeof ts === "string" ? new Date(ts) : ts;
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
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
  // Intents from DB are the display source of truth (they carry sourceChain/destChain).
  // Fall back to on-chain records only when intents haven't loaded yet.
  const displayHistory = intents.length > 0 ? intents : onChainRecords;
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
      <div className="min-h-[100dvh] w-full bg-black text-white selection:bg-white selection:text-black">
        <main className="w-full max-w-7xl mx-auto p-4 md:p-8">
          {/* Header */}
          <header className="flex items-center justify-between py-8 border-b-2 border-white mb-12">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <span className="text-black font-black text-2xl">B</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase">Blip</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2">
                <div className="w-2 h-2 bg-white" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">System Live</span>
              </div>
              <div className="px-4 py-2 border border-white flex items-center gap-3">
                <span className="text-xs font-black uppercase mono tracking-widest">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'DISCONNECTED'}
                </span>
                <div className={`w-2 h-2 ${walletAddress ? 'bg-white' : 'bg-zinc-800'}`} />
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-16">
            {/* Left Column: Asset Intelligence */}
            <div className="xl:col-span-4 space-y-12">
              <section className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Global Liquidity</p>
                  <h2 className="text-7xl font-black tracking-tighter mono">
                    ${totalUsdcVal.split('.')[0]}<span className="text-zinc-600">.{totalUsdcVal.split('.')[1]}</span>
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="p-6 border border-zinc-800 hover:border-white transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">World Chain</span>
                      <button 
                        onClick={() => handleAddToken(4801)}
                        className="text-[9px] font-black uppercase border border-zinc-800 px-2 py-0.5 hover:bg-white hover:text-black transition-all"
                      >
                        + Add
                      </button>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl font-black mono">${formattedWorldBal}</p>
                      <p className="text-[10px] font-bold text-zinc-500 mono">{formattedWorldNative} ETH</p>
                    </div>
                  </div>

                  <div className="p-6 border border-zinc-800 hover:border-white transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Base Sepolia</span>
                      <button 
                        onClick={() => handleAddToken(84532)}
                        className="text-[9px] font-black uppercase border border-zinc-800 px-2 py-0.5 hover:bg-white hover:text-black transition-all"
                      >
                        + Add
                      </button>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl font-black mono">${formattedBaseBal}</p>
                      <p className="text-[10px] font-bold text-zinc-500 mono">{formattedBaseNative} ETH</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button className="py-5 bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-zinc-200 active:scale-[0.98] transition-all">
                    Deposit
                  </button>
                  <Link href="/bridge" className="flex items-center justify-center py-5 border border-white text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black active:scale-[0.98] transition-all">
                    Bridge
                  </Link>
                </div>
              </section>
            </div>

            {/* Right Column: Signal History */}
            <div className="xl:col-span-8">
              <section className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Signal History</h3>
                  <div className="h-[1px] flex-1 mx-6 bg-zinc-900" />
                  <button className="text-[10px] font-black uppercase tracking-widest text-white hover:underline underline-offset-4">Archived</button>
                </div>

                <div className="space-y-px bg-zinc-900 border border-zinc-900">
                  {displayHistory.length === 0 ? (
                    <div className="bg-black py-20 flex flex-col items-center justify-center border border-dashed border-zinc-800">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">No active signals found</p>
                    </div>
                  ) : (
                    displayHistory.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-black p-6 group flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-zinc-950 transition-colors"
                      >
                        <div className="flex items-center gap-6">
                          <div className={`w-8 h-8 flex items-center justify-center border ${
                            item.status === 'COMPLETED' ? 'border-white bg-white text-black' : 'border-zinc-800 text-zinc-500'
                          }`}>
                            <ArrowRightLeft size={14} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="text-xl font-black mono uppercase">{item.amount} USDC</h4>
                              <span className={`text-[8px] font-black px-2 py-0.5 border ${
                                item.status === 'COMPLETED' ? 'border-white' : 'border-zinc-700 animate-pulse'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                              {(item as any).sourceChain === 'BASE_SEPOLIA' ? 'Base' : 'World'} 
                              <span className="mx-2 text-zinc-800">→</span> 
                              {(item as any).destChain === 'BASE_SEPOLIA' ? 'Base' : 'World'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-left md:text-right">
                             <p className="text-[10px] text-zinc-500 font-black uppercase tracking-tighter">
                              {formatTime(
                                item.status === 'COMPLETED'
                                  ? ((item as any).completedAt || (item as any).createdAt || (item as any).timestamp)
                                  : ((item as any).createdAt || (item as any).timestamp)
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2">
                             {((item as any).sourceTxHash || (item as any).burnTxHash) && (
                              <a 
                                href={(item as any).sourceChain === 'BASE_SEPOLIA' 
                                  ? `https://sepolia.basescan.org/tx/${(item as any).sourceTxHash || (item as any).burnTxHash}`
                                  : `https://worldchain-sepolia.explorer.alchemy.com/tx/${(item as any).sourceTxHash || (item as any).burnTxHash}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 flex items-center justify-center border border-zinc-800 hover:border-white text-zinc-600 hover:text-white transition-all"
                              >
                                <LinkIcon size={12} />
                              </a>
                            )}
                             {(item.status === 'COMPLETED' || (item as any).destTxHash || (item as any).baseTxHash) && (
                               <a 
                                 href={(item as any).destChain === 'WORLD_CHAIN'
                                   ? `https://worldchain-sepolia.explorer.alchemy.com/tx/${(item as any).destTxHash || (item as any).baseTxHash}`
                                   : `https://sepolia.basescan.org/tx/${(item as any).destTxHash || (item as any).baseTxHash}`
                                 }
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="w-8 h-8 flex items-center justify-center border border-zinc-800 hover:border-white text-zinc-600 hover:text-white transition-all"
                               >
                                 <LinkIcon size={12} />
                               </a>
                             )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>

          <ChatInterface />
        </main>
      </div>
    </AuthGate>

  );
}
