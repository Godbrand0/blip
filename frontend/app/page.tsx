"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { useIntents } from "@/hooks/useIntents";
import { Wallet, ArrowUpRight, TrendingUp, History } from "lucide-react";
import { AuthGate } from "@/src/components/AuthGate";

export default function HomePage() {
  return (
    <AuthGate>
      <div className="min-h-screen bg-[#F5F5F7] p-6 lg:p-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Stats & Actions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between h-[240px]">
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total USDC Balance</p>
                <h2 className="text-4xl font-bold text-gray-900 mt-2">$2,450.00</h2>
              </div>
              <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
                <TrendingUp size={16} />
                <span>+12.5% this month</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="bg-black text-white p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-transform hover:scale-95 active:scale-90">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <span className="text-xs font-bold">Deposit</span>
              </button>
              <button className="bg-white text-gray-900 p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 transition-transform hover:scale-95 active:scale-90">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <ArrowUpRight size={20} />
                </div>
                <span className="text-xs font-bold">Withdraw</span>
              </button>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <History size={16} />
                  Recent Activity
                </h3>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-center text-gray-400 py-4 italic">No recent cross-chain transfers</p>
              </div>
            </div>
          </div>

          {/* Right Column: AI Chat Agent */}
          <div className="lg:col-span-8">
            <header className="mb-8 hidden lg:block">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">ChainBridge AI</h1>
              <p className="text-gray-500 font-medium mt-1">Intelligent cross-chain asset management</p>
            </header>
            <ChatInterface />
          </div>

        </div>
      </div>
    </AuthGate>
  );
}
