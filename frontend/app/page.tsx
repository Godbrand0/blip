"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { useIntents } from "@/hooks/useIntents";
import { Wallet, History, ArrowRightLeft, Sparkles, TrendingUp, Link as LinkIcon } from "lucide-react";
import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/contexts/AuthContext";
import { motion } from "framer-motion";
import { useBalance } from "wagmi";

// USDC contract address on World Chain
const USDC_ADDRESS = "0x79A02482A880bCE3F13e09Da470d9a69E8CAce0A";

export default function HomePage() {
  const { walletAddress } = useAuth();
  const { intents } = useIntents();

  const { data: balanceData } = useBalance({
    address: walletAddress as `0x${string}`,
    token: USDC_ADDRESS,
    query: {
      enabled: !!walletAddress,
      refetchInterval: 10000, // Refresh every 10 seconds
    }
  });

  const rawBalance = balanceData?.formatted ? parseFloat(balanceData.formatted) : 0;
  const formattedBalance = isNaN(rawBalance)
    ? "0.00"
    : rawBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Total USDC Balance</p>
                <div className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest text-indigo-300">
                  World Chain
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-5xl font-black tracking-tighter">${formattedBalance}</h2>
                <div className="flex items-center justify-center gap-2 text-green-400 font-black text-[11px] uppercase tracking-wider">
                  <TrendingUp size={14} />
                  <span>+12.5% vs last week</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4">
                <button className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-95 group">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
                    <Wallet size={18} className="text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Deposit</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-95 group">
                  <div className="w-10 h-10 bg-cyan-600/20 rounded-xl flex items-center justify-center group-hover:bg-cyan-600/30 transition-colors">
                    <ArrowRightLeft size={18} className="text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bridge</span>
                </button>
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
              {intents.length === 0 ? (
                <div className="glass-card p-10 flex flex-col items-center text-center space-y-4 border-dashed">
                  <div className="w-12 h-12 bg-glass-hover rounded-full flex items-center justify-center">
                    <LinkIcon size={20} className="text-zinc-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">No cross-chain transfers yet.</p>
                </div>
              ) : (
                intents.map((intent, idx) => (
                  <motion.div 
                    key={intent.intentId || idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="glass-card p-5 flex items-center justify-between group hover:bg-glass-hover transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        intent.status === 'COMPLETED' ? 'bg-green-500/10' : 'bg-indigo-500/10'
                      }`}>
                        <ArrowRightLeft size={20} className={intent.status === 'COMPLETED' ? 'text-green-500' : 'text-indigo-500'} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black">{intent.amount} USDC</h4>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">World → Base</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                        intent.status === 'COMPLETED' 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-indigo-500/10 text-indigo-500 animate-pulse'
                      }`}>
                        {intent.status}
                      </span>
                      <p className="text-[10px] text-zinc-600 mt-2 font-mono">{intent.recipient.slice(0, 6)}...{intent.recipient.slice(-4)}</p>
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
