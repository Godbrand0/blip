"use client";

import { useAccount } from "wagmi";
import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/contexts/AuthContext";
import { useIntents } from "@/hooks/useIntents";
import { ArrowLeft, Copy, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const CHAIN_LABEL: Record<string, string> = {
  WORLD_CHAIN: "World Chain",
  BASE_SEPOLIA: "Base Sepolia",
  MONAD_TESTNET: "Monad Testnet",
  ARC_TESTNET: "Arc Testnet",
};

const CHAIN_EXPLORER: Record<string, string> = {
  WORLD_CHAIN: "https://worldchain-sepolia.explorer.alchemy.com",
  BASE_SEPOLIA: "https://sepolia.basescan.org",
  MONAD_TESTNET: "https://testnet.monadexplorer.com",
  ARC_TESTNET: "https://testnet.arcscan.app",
};

export default function ProfilePage() {
  return (
    <AuthGate>
      <Profile />
    </AuthGate>
  );
}

function Profile() {
  const { address } = useAccount();
  const { walletAddress } = useAuth();
  const displayAddress = address || walletAddress;
  const { intents } = useIntents(displayAddress);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!displayAddress) return;
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completed = intents.filter((i) => i.status === "COMPLETED");
  const totalUsdc = completed.reduce((sum, i) => sum + (i.amount ?? 0), 0);

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white">
      <main className="relative z-10 w-full max-w-5xl mx-auto p-6 md:p-10 pb-32 space-y-12">

        {/* Header */}
        <header className="flex items-center justify-between border-b-2 border-white pb-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="w-12 h-12 border-2 border-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Profile</h1>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">
                IDENTITY NODE
              </p>
            </div>
          </div>
        </header>

        {/* Wallet Address */}
        <div className="border-2 border-white p-8 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 block">
              Proxy Address
            </span>
            <p className="text-sm md:text-base font-mono text-white break-all">
              {displayAddress || "Not connected"}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 w-10 h-10 border-2 border-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
            title="Copy address"
          >
            {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-white border-2 border-white">
          <div className="bg-black p-8 flex flex-col gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Total Transfers</span>
            <span className="text-4xl font-black">{intents.length}</span>
          </div>
          <div className="bg-black p-8 flex flex-col gap-2 border-l border-zinc-900">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Completed</span>
            <span className="text-4xl font-black">{completed.length}</span>
          </div>
          <div className="bg-black p-8 flex flex-col gap-2 border-l border-zinc-900">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Total Bridged</span>
            <span className="text-4xl font-black">{totalUsdc.toFixed(2)}</span>
            <span className="text-[9px] font-mono text-zinc-600">USDC</span>
          </div>
        </div>

        {/* Bridge History */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Bridge History</span>
            <div className="h-[1px] flex-1 mx-6 bg-zinc-900" />
            <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-ping" />
              LIVE
            </span>
          </div>

          {intents.length === 0 ? (
            <div className="border-2 border-zinc-900 p-16 flex flex-col items-center text-center space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">No transfers found</p>
              <p className="text-[9px] text-zinc-700 uppercase tracking-widest">Bridge USDC to see your history here</p>
              <Link
                href="/bridge"
                className="mt-4 px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
              >
                Launch Bridge
              </Link>
            </div>
          ) : (
            <div className="border-2 border-white overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="border-b-2 border-white">
                  <tr>
                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Intent ID</th>
                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Amount</th>
                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Route</th>
                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Recipient</th>
                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 font-mono text-xs">
                  {intents.map((intent, idx) => {
                    const srcLabel = CHAIN_LABEL[intent.sourceChain ?? ""] ?? intent.sourceChain ?? "—";
                    const dstLabel = CHAIN_LABEL[intent.destChain ?? ""] ?? intent.destChain ?? "—";
                    const srcExplorer = CHAIN_EXPLORER[intent.sourceChain ?? ""];
                    const dstExplorer = CHAIN_EXPLORER[intent.destChain ?? ""];
                    const shortRecipient = intent.recipient
                      ? `${intent.recipient.slice(0, 6)}...${intent.recipient.slice(-4)}`
                      : "—";

                    return (
                      <tr key={intent.intentId ?? idx} className="hover:bg-zinc-950 transition-colors">
                        <td className="p-4 border-r border-zinc-900 text-zinc-400">
                          {intent.intentId ? `${intent.intentId.slice(0, 16)}...` : "—"}
                        </td>
                        <td className="p-4 border-r border-zinc-900 font-bold text-white">
                          {(intent.amount ?? 0).toFixed(2)} USDC
                        </td>
                        <td className="p-4 border-r border-zinc-900 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                          {srcLabel}
                          <span className="mx-2 text-zinc-700">→</span>
                          {dstLabel}
                        </td>
                        <td className="p-4 border-r border-zinc-900 text-zinc-400">
                          {shortRecipient}
                        </td>
                        <td className="p-4 border-r border-zinc-900">
                          <span className={`text-[8px] font-black px-2 py-0.5 border ${
                            intent.status === "COMPLETED"
                              ? "border-white text-white"
                              : intent.status === "FAILED"
                              ? "border-red-800 text-red-600"
                              : "border-zinc-700 text-zinc-400 animate-pulse"
                          }`}>
                            {intent.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {intent.burnTxHash && srcExplorer && (
                              <a
                                href={`${srcExplorer}/tx/${intent.burnTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Source tx"
                                className="w-6 h-6 border border-zinc-800 hover:border-white text-zinc-500 hover:text-white flex items-center justify-center transition-all"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                            {intent.baseTxHash && dstExplorer && (
                              <a
                                href={`${dstExplorer}/tx/${intent.baseTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Destination tx"
                                className="w-6 h-6 border border-zinc-800 hover:border-white text-zinc-500 hover:text-white flex items-center justify-center transition-all"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
