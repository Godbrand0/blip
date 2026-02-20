"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  IDKitWidget,
  VerificationLevel,
  ISuccessResult,
} from "@worldcoin/idkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAuth } from "@/src/contexts/AuthContext";
import { Bot, ShieldCheck, UserCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const { isWorldIdVerified, isMiniKit, setVerified } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMiniKitVerify = async () => {
    if (!MiniKit.isInstalled()) return;
    setVerifying(true);
    setError(null);

    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: process.env.NEXT_PUBLIC_WORLD_ACTION_ID!,
        verification_level: VerificationLevel.Device,
      });

      if (finalPayload.status === "error") {
        setError("Verification was cancelled or failed.");
        return;
      }

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: finalPayload,
          action: process.env.NEXT_PUBLIC_WORLD_ACTION_ID!,
        }),
      });

      const result = await res.json();
      if (result.status === 200) {
        setVerified(finalPayload as ISuccessResult);
      } else {
        setError(result.verifyRes?.detail || "Verification failed.");
      }
    } catch (err: any) {
      console.error("MiniKit verify error:", err);
      setError(err.message || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleBrowserVerify = async (proof: ISuccessResult) => {
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Verification failed.");
      if (!result.success) throw new Error("World ID verification failed.");
      
      setVerified(proof);
    } catch (err) {
      console.error("Verification process failed:", err);
      throw err;
    }
  };

  // Onboarding UI Wrapper
  const OnboardingLayout = ({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm glass-card p-10 flex flex-col items-center text-center space-y-8 relative z-10"
      >
        <div className="w-20 h-20 bg-indigo-600/20 rounded-3xl flex items-center justify-center premium-glow animate-float">
          <Bot size={40} className="text-indigo-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter uppercase whitespace-nowrap">
            {title}
          </h1>
          <p className="text-zinc-400 text-sm font-medium">
            {subtitle}
          </p>
        </div>

        {children}
        
        <div className="pt-4 flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          <ShieldCheck size={12} />
          <span>Secured by World ID</span>
        </div>
      </motion.div>
    </div>
  );

  if (isMiniKit) {
    if (!isWorldIdVerified) {
      return (
        <OnboardingLayout 
          title="Chain Bridge" 
          subtitle="Verify your humanness to start bridging assets."
        >
          <div className="w-full space-y-4">
            {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
            <button
              onClick={handleMiniKitVerify}
              disabled={verifying}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {verifying ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={18} />}
              {verifying ? "Verifying..." : "Verify with World App"}
            </button>
          </div>
        </OnboardingLayout>
      );
    }
    return <>{children}</>;
  }

  if (!isConnected) {
    return (
      <OnboardingLayout 
        title="Welcome" 
        subtitle="Connect your wallet to enter the bridge ecosystem."
      >
        <div className="flex justify-center w-full">
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-600/20"
              >
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      </OnboardingLayout>
    );
  }

  if (!isWorldIdVerified) {
    return (
      <OnboardingLayout 
        title="Human Check" 
        subtitle="Final security step to prevent sybil attacks."
      >
        <IDKitWidget
          app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`}
          action={process.env.NEXT_PUBLIC_WORLD_ACTION_ID!}
          onSuccess={(proof) => setVerified(proof)}
          handleVerify={handleBrowserVerify}
          verification_level={VerificationLevel.Device}
        >
          {({ open }) => (
            <button
              onClick={open}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              <UserCheck size={18} />
              Verify with Phone
            </button>
          )}
        </IDKitWidget>
      </OnboardingLayout>
    );
  }

  return <>{children}</>;
}
