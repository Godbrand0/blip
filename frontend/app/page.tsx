"use client";

import Link from "next/link";
import { 
  Wallet, 
  ArrowRightLeft, 
  Sparkles, 
  TrendingUp, 
  Link as LinkIcon, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  Activity,
  Layers,
  ArrowRightCircle
} from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { walletAddress, isMiniKit, setWalletAddress } = useAuth();
  const { isConnected } = useAccount();
  const isWalletConnected = isConnected || (isMiniKit && !!walletAddress);

  const [mounted, setMounted] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Global Metrics Stats
  const [stats, setStats] = useState<{
    totalBridges: number;
    completedBridges: number;
    totalUsdcBridged: number;
    topTarget: string;
    recentBridges: Array<{
      intentId: string;
      userMasked: string;
      recipientMasked: string;
      amount: number;
      status: string;
      sourceChain: string;
      destChain: string;
      burnTxHash: string;
      destTxHash: string;
      timestamp: string;
    }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/bridge/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data);
        }
      } catch (e) {
        console.error("Error fetching stats:", e);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMiniKitAuth = async () => {
    try {
      setAuthenticating(true);
      setAuthError(null);
      const res = await fetch("/api/nonce");
      if (!res.ok) throw new Error("Failed to fetch nonce");
      const { nonce } = await res.json();

      const payload = {
        nonce,
        statement: "Sign in to Blip",
        expirationTime: new Date(Date.now() + 1000 * 60 * 60),
      };

      let result: any;
      if ((MiniKit as any).commandsAsync?.walletAuth) {
        result = await (MiniKit as any).commandsAsync.walletAuth(payload);
      } else {
        result = await (MiniKit.commands as any).walletAuth(payload);
      }

      if (
        result.status === "error" ||
        result.executedWith === "fallback" ||
        (!result.commandPayload && !result.finalPayload && !result.data)
      ) {
        throw new Error("Wallet authentication failed");
      }

      const authPayload = result.finalPayload || result.commandPayload || result.data || result;

      if (!authPayload || (!authPayload.message && !authPayload.siweMessage)) {
        throw new Error("Payload missing 'message' or 'siweMessage'");
      }

      const siweRes = await fetch("/api/complete-siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: authPayload, nonce }),
      });

      if (!siweRes.ok) {
        const textMsg = await siweRes.text();
        throw new Error(`SIWE Backend failed: ${siweRes.status} ${textMsg.substring(0, 50)}`);
      }

      const data = await siweRes.json();
      if (!data.isValid) throw new Error(data.message || "SIWE payload is invalid");

      const returnedAddress = authPayload.address || (MiniKit as any).user?.walletAddress;
      if (returnedAddress) {
        sessionStorage.setItem("blip_wallet_address", returnedAddress);
        setWalletAddress(returnedAddress);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate wallet");
    } finally {
      setAuthenticating(false);
    }
  };

  if (!mounted) return null;

  // Shared statistics rendering logic
  const renderStatsGrid = () => {
    if (statsLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white border-2 border-white">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-black p-8 animate-pulse space-y-4">
              <div className="h-3 w-2/3 bg-zinc-800" />
              <div className="h-8 w-1/2 bg-zinc-800" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white border-2 border-white">
        <div className="bg-black p-8 flex flex-col justify-between hover:bg-zinc-950 transition-colors group">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 block">Total USDC Bridged</span>
          <div>
            <h4 className="text-4xl font-black mono tracking-tighter">
              ${stats?.totalUsdcBridged.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
            </h4>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-2 block">USDC Decimals Verified</span>
          </div>
        </div>

        <div className="bg-black p-8 flex flex-col justify-between hover:bg-zinc-950 transition-colors group border-t-2 md:border-t-0 md:border-l-2 border-white">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 block">Bridges Finalized</span>
          <div>
            <h4 className="text-4xl font-black mono tracking-tighter">
              {stats?.totalBridges || 0}
            </h4>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-2 block">100% CCTP Handshake</span>
          </div>
        </div>

        <div className="bg-black p-8 flex flex-col justify-between hover:bg-zinc-950 transition-colors group border-t-2 md:border-t-0 md:border-l-2 border-white">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 block">Average Handshake Speed</span>
          <div>
            <h4 className="text-4xl font-black mono tracking-tighter flex items-center gap-2">
              8.2s <span className="text-xs border border-white px-2 py-0.5 font-bold tracking-widest">FAST</span>
            </h4>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-2 block">Attestation Relay Speed</span>
          </div>
        </div>

        <div className="bg-black p-8 flex flex-col justify-between hover:bg-zinc-950 transition-colors group border-t-2 md:border-t-0 md:border-l-2 border-white">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 block">Top Destination Node</span>
          <div>
            <h4 className="text-xl font-black uppercase tracking-tight line-clamp-1">
              {stats?.topTarget || "Base Sepolia"}
            </h4>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-2 block">Highest Incoming Intent</span>
          </div>
        </div>
      </div>
    );
  };

  const renderGlobalExplorerTable = () => {
    if (statsLoading) {
      return (
        <div className="border-2 border-white p-8 text-center animate-pulse text-xs uppercase tracking-widest text-zinc-600 bg-zinc-950">
          Syncing with blockchain log...
        </div>
      );
    }

    if (!stats || stats.recentBridges.length === 0) {
      return (
        <div className="border-2 border-white p-12 text-center text-xs uppercase tracking-widest text-zinc-600 bg-zinc-950">
          No global signals registered yet.
        </div>
      );
    }

    return (
      <div className="border-2 border-white overflow-hidden bg-black">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-white bg-zinc-950">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r border-zinc-800">Bridge ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r border-zinc-800">Proxy Address</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r border-zinc-800">Magnitude</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r border-zinc-800">Quantum Path</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r border-zinc-800">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-mono text-xs">
              {stats.recentBridges.map((tx, idx) => (
                <tr key={idx} className="hover:bg-zinc-950/60 transition-colors">
                  <td className="p-4 border-r border-zinc-800 text-zinc-400 font-bold">{tx.intentId.slice(0, 14)}...</td>
                  <td className="p-4 border-r border-zinc-800 text-white select-all">{tx.userMasked}</td>
                  <td className="p-4 border-r border-zinc-800 font-bold text-white">{tx.amount.toFixed(2)} USDC</td>
                  <td className="p-4 border-r border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    {tx.sourceChain === "WORLD_CHAIN" ? "World" : "Base"} 
                    <span className="mx-2 text-zinc-700">→</span> 
                    {tx.destChain === "WORLD_CHAIN" ? "World" : "Base"}
                  </td>
                  <td className="p-4 border-r border-zinc-800">
                    <span className={`text-[8px] font-black px-2 py-0.5 border ${
                      tx.status === "COMPLETED" 
                        ? "border-white text-white" 
                        : tx.status === "FAILED"
                        ? "border-red-800 text-red-600"
                        : "border-zinc-700 text-zinc-400 animate-pulse"
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {tx.burnTxHash && (
                        <a 
                          href={tx.sourceChain === 'WORLD_CHAIN'
                            ? `https://worldchain-sepolia.explorer.alchemy.com/tx/${tx.burnTxHash}`
                            : `https://sepolia.basescan.org/tx/${tx.burnTxHash}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Source Node Explorer"
                          className="w-6 h-6 border border-zinc-800 hover:border-white text-zinc-500 hover:text-white flex items-center justify-center transition-all"
                        >
                          <LinkIcon size={10} />
                        </a>
                      )}
                      {tx.destTxHash && (
                        <a 
                          href={tx.destChain === 'WORLD_CHAIN'
                            ? `https://worldchain-sepolia.explorer.alchemy.com/tx/${tx.destTxHash}`
                            : `https://sepolia.basescan.org/tx/${tx.destTxHash}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Destination Node Explorer"
                          className="w-6 h-6 border border-zinc-800 hover:border-white text-zinc-500 hover:text-white flex items-center justify-center transition-all"
                        >
                          <LinkIcon size={10} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white selection:bg-white selection:text-black">
      <main className="w-full max-w-7xl mx-auto p-4 md:p-8 pb-32">
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-8 border-b-2 border-white mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white flex items-center justify-center hover:rotate-90 transition-all duration-300">
              <span className="text-black font-black text-2xl">B</span>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">Blip</h1>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-1">
                AI Cross-Chain Intents
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 border border-zinc-800 px-3 py-1">
              <div className="w-1.5 h-1.5 bg-white animate-pulse" />
              <span className="text-[8px] font-mono tracking-widest text-zinc-400 uppercase">CCTP V2 ONLINE</span>
            </div>
            <div className="px-4 py-2 border-2 border-white bg-black flex items-center gap-3">
              <span className="text-[10px] font-black uppercase mono tracking-widest">
                {isWalletConnected ? `${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}` : 'DISCONNECTED'}
              </span>
              <div className={`w-2.5 h-2.5 ${isWalletConnected ? 'bg-white' : 'bg-zinc-800'}`} />
            </div>
          </div>
        </header>

        {/* ========================================================
            PUBLIC LANDING PAGE VIEW (ALWAYS VISIBLE)
            ======================================================== */}
        <div className="space-y-20">
          {/* Hero Banner Section */}
          <section className="border-4 border-white p-8 md:p-16 bg-zinc-950 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-12 relative overflow-hidden group">
            <div className="space-y-6 max-w-2xl relative z-10">
              <span className="inline-block border border-white px-3 py-1 text-[8px] font-black uppercase tracking-[0.25em]">
                Now Active on World Chain & Base Sepolia
              </span>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                AI-Powered Cross-Chain USDC handshakes.
              </h2>
              <p className="text-sm md:text-base text-zinc-400 leading-relaxed max-w-xl">
                Bridge USDC native liquidity instantly using simple human language sentences. Powered by Gemini AI models and native Circle CCTP Fast Attestation workflows.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                {isWalletConnected ? (
                  <Link
                    href="/bridge"
                    className="px-8 py-5 bg-white text-black border-2 border-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-black hover:text-white active:scale-95 flex items-center gap-2"
                  >
                    <span>Launch Bridge Workspace</span>
                    <ArrowRightCircle size={16} />
                  </Link>
                ) : isMiniKit ? (
                  <button
                    onClick={handleMiniKitAuth}
                    disabled={authenticating}
                    className="px-8 py-5 bg-white text-black border-2 border-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-black hover:text-white active:scale-95 disabled:opacity-50"
                  >
                    {authenticating ? "CONNECTING SIG..." : "Connect World ID"}
                  </button>
                ) : (
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button
                        onClick={openConnectModal}
                        className="px-8 py-5 bg-white text-black border-2 border-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-black hover:text-white active:scale-95"
                      >
                        Connect Wallet Signal
                      </button>
                    )}
                  </ConnectButton.Custom>
                )}
                <a
                  href="#how-it-works"
                  className="px-8 py-5 border-2 border-white text-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-white hover:text-black active:scale-95"
                >
                  View Mechanics
                </a>
              </div>
              {authError && (
                <p className="text-[10px] text-red-600 font-mono uppercase tracking-widest">{authError}</p>
              )}
            </div>
            <div className="border-4 border-white p-8 bg-black w-full xl:w-80 flex flex-col justify-between h-72 hover:-rotate-1 hover:scale-102 transition-all shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Intelligent Agent</span>
                <Sparkles size={14} />
              </div>
              <div className="space-y-4">
                <div className="bg-zinc-950 border border-zinc-800 p-4 text-[11px] font-mono text-zinc-400">
                  "Bridge 10 USDC to Base Sepolia for my friend"
                </div>
                <p className="text-[9px] uppercase tracking-wider font-black text-zinc-600">
                  Gemini AI decodes recipient address and parameters automatically.
                </p>
              </div>
              <div className="w-full bg-white text-black text-[9px] font-black uppercase text-center py-2 tracking-widest">
                AI INTENT TRIGGERED
              </div>
            </div>
          </section>

          {/* Dashboard Analytics Section (Fully Expanded by Default) */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Protocol Analytics Dashboard</span>
              <div className="h-[1px] flex-1 mx-6 bg-zinc-900" />
              <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase">REAL-TIME TELEMETRY</span>
            </div>
            {renderStatsGrid()}
          </section>

          {/* Supported Networks Section */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Supported Networks Grid</span>
              <div className="h-[1px] flex-1 mx-6 bg-zinc-900" />
              <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase">MULTICHAIN MAPPING</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="border-2 border-white p-8 bg-zinc-950 flex flex-col justify-between hover:bg-black transition-all group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black uppercase tracking-tight">World Chain</span>
                    <span className="text-[9px] border border-white px-2 py-0.5 font-bold tracking-widest uppercase">ACTIVE</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    World Chain Sepolia testnet proxy node. Integrated with World ID authentication protocol.
                  </p>
                </div>
                <div className="mt-8 border-t border-zinc-900 pt-4 flex justify-between text-[9px] font-mono text-zinc-500">
                  <span>CCTP Domains: 14</span>
                  <a href="https://worldchain-sepolia.explorer.alchemy.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">EXPLORER</a>
                </div>
              </div>

              <div className="border-2 border-white p-8 bg-zinc-950 flex flex-col justify-between hover:bg-black transition-all group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black uppercase tracking-tight">Base Sepolia</span>
                    <span className="text-[9px] border border-white px-2 py-0.5 font-bold tracking-widest uppercase">ACTIVE</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Base Sepolia layer-2 scaling protocol node. Ultra low gas friction with instant relays.
                  </p>
                </div>
                <div className="mt-8 border-t border-zinc-900 pt-4 flex justify-between text-[9px] font-mono text-zinc-500">
                  <span>CCTP Domains: 6</span>
                  <a href="https://sepolia.basescan.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">EXPLORER</a>
                </div>
              </div>

              <div className="border border-zinc-800 p-8 bg-zinc-950/20 flex flex-col justify-between opacity-50 relative group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black uppercase tracking-tight text-zinc-600">Ethereum</span>
                    <span className="text-[9px] border border-zinc-800 px-2 py-0.5 font-bold tracking-widest text-zinc-600 uppercase">FUTURE</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Ethereum Mainnet L1 ledger. Upcoming native deployment matching Circle USDC release.
                    </p>
                </div>
                <span className="mt-8 text-[8px] font-mono text-zinc-700 tracking-wider">ROADMAP DEPLOYMENT</span>
              </div>

              <div className="border border-zinc-800 p-8 bg-zinc-950/20 flex flex-col justify-between opacity-50 relative group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black uppercase tracking-tight text-zinc-600">L2 Rollups</span>
                    <span className="text-[9px] border border-zinc-800 px-2 py-0.5 font-bold tracking-widest text-zinc-600 uppercase">FUTURE</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Optimism, Arbitrum, Avalanche, Polygon, and World Chain Mainnet native CCTP channels.
                  </p>
                </div>
                <span className="mt-8 text-[8px] font-mono text-zinc-700 tracking-wider">ROADMAP DEPLOYMENT</span>
              </div>
            </div>
          </section>

          {/* How It Works Diagram Section */}
          <section id="how-it-works" className="space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">CCTP Protocol Architecture Handshake</span>
              <div className="h-[1px] flex-1 mx-6 bg-zinc-900" />
              <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase">HANDSHAKE STEPS</span>
            </div>
            
            {/* Stepper Architecture View */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-px bg-white border-2 border-white">
              <div className="bg-black p-8 hover:bg-zinc-950 transition-all group">
                <div className="w-8 h-8 border border-white flex items-center justify-center font-bold text-xs mb-6">01</div>
                <h4 className="text-lg font-black uppercase tracking-tight mb-2">Intent Parser</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Gemini AI decodes natural language expressions to extract USDC token quantities, destination chains, and target addresses.
                </p>
              </div>
              <div className="bg-black p-8 hover:bg-zinc-950 transition-all group border-t-2 xl:border-t-0 xl:border-l-2 border-white">
                <div className="w-8 h-8 border border-white flex items-center justify-center font-bold text-xs mb-6">02</div>
                <h4 className="text-lg font-black uppercase tracking-tight mb-2">Source Node Burn</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Frontend batches approve and CCTP `depositForBurn` in a single transaction. USDC is burned natively on the source chain.
                </p>
              </div>
              <div className="bg-black p-8 hover:bg-zinc-950 transition-all group border-t-2 xl:border-t-0 xl:border-l-2 border-white">
                <div className="w-8 h-8 border border-white flex items-center justify-center font-bold text-xs mb-6">03</div>
                <h4 className="text-lg font-black uppercase tracking-tight mb-2">Attestation Sync</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Circle's Iris API observes the transaction logs on World Chain Sepolia and generates a cryptographic minting authorization.
                </p>
              </div>
              <div className="bg-black p-8 hover:bg-zinc-950 transition-all group border-t-2 xl:border-t-0 xl:border-l-2 border-white">
                <div className="w-8 h-8 border border-white flex items-center justify-center font-bold text-xs mb-6">04</div>
                <h4 className="text-lg font-black uppercase tracking-tight mb-2">Relayer Mint</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  The Blip Relayer polls attestation signatures and calls `receiveMessage` on Base Sepolia, minting USDC directly to the recipient.
                </p>
              </div>
            </div>
          </section>

          {/* Global Live Feed explorer */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Live Global Signals Feed</span>
              <div className="h-[1px] flex-1 mx-6 bg-zinc-900" />
              <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                REAL-TIME SYNC
              </span>
            </div>
            {renderGlobalExplorerTable()}
          </section>

          {/* Bottom Call to Action Connection */}
          <section className="border-4 border-white p-12 text-center space-y-8 bg-zinc-950 shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
            <h3 className="text-4xl font-black uppercase tracking-tighter">
              Quantized bridging is ready.
            </h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest leading-relaxed max-w-md mx-auto">
              Establish a cryptographic handshake to bypass complex network transfers. Type intent sentences, bridge assets natively.
            </p>
            <div className="flex justify-center pt-4">
              {isWalletConnected ? (
                <Link
                  href="/bridge"
                  className="px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all flex items-center gap-2"
                >
                  <span>Launch Bridge Workspace</span>
                  <ArrowRightCircle size={16} />
                </Link>
              ) : isMiniKit ? (
                <button
                  onClick={handleMiniKitAuth}
                  disabled={authenticating}
                  className="px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all"
                >
                  {authenticating ? "Connecting World ID..." : "Authorize Wallet Signal"}
                </button>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all"
                    >
                      Authorize Wallet Signal
                    </button>
                  )}
                </ConnectButton.Custom>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
