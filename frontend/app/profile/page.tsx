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
  const { isWorldIdVerified, worldIdProof } = useAuth();

  return (
    <div className="min-h-screen bg-black p-6 text-white min-h-[100dvh] w-full bg-black text-white selection:bg-indigo-500/30">
        {/* Background Gradients */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/5 rounded-full blur-[120px]" />
        </div>

      <div className="relative z-10 mx-auto max-w-2xl space-y-8 pt-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-4">Profile</h1>
          <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-glass-border">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Wallet Address</span>
            <p className="text-sm text-zinc-300 font-mono truncate">{address}</p>
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-black tracking-tight uppercase">Identity Verification</h2>
          <div className="flex items-center gap-3">
            {isWorldIdVerified ? (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse blur-[1px]"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full absolute"></div>
                <span className="text-green-400 font-bold ml-1">World ID Verified</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-800/80 px-2 py-1 rounded">
                  Human Status Confirmed
                </span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-zinc-500 rounded-full"></div>
                <span className="text-zinc-400 font-bold">Not Verified</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
                  World ID Required
                </span>
              </>
            )}
          </div>
          {worldIdProof && (
            <div className="text-[10px] font-mono text-zinc-400 space-y-2 mt-4 pt-4 border-t border-glass-border">
              <div className="flex justify-between">
                <span className="text-zinc-500">Verification Level:</span>
                <span className="text-indigo-400 text-right">{worldIdProof.verification_level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Nullifier Hash:</span>
                <span className="truncate w-48 text-right">{worldIdProof.nullifier_hash ? `${worldIdProof.nullifier_hash.slice(0, 10)}...${worldIdProof.nullifier_hash.slice(-6)}` : 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
