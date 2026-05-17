"use client";

import { useAccount } from "wagmi";
import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/contexts/AuthContext";

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

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white">
      <div className="relative z-10 w-full max-w-3xl mx-auto p-6 md:p-10 pb-32 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter uppercase text-white">Profile</h1>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Account Details</p>
        </div>

        <div className="p-5 border border-zinc-800">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Wallet Address</span>
          <p className="text-sm text-white font-mono break-all">{displayAddress || "Not connected"}</p>
        </div>

        <div className="p-6 border border-zinc-800 space-y-4">
          <h2 className="text-lg font-black tracking-tight uppercase text-white">Network</h2>
          <div className="space-y-2 text-[10px] font-mono text-zinc-400">
            <div className="flex justify-between">
              <span className="text-zinc-500">Source Chain</span>
              <span className="text-white">World Chain Sepolia (4801)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Destination Chain</span>
              <span className="text-white">Base Sepolia (84532)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Bridge Protocol</span>
              <span className="text-white">Circle CCTP V2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
