"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  IDKitRequestWidget,
  deviceLegacy,
  type RpContext,
  type IDKitResult,
} from "@worldcoin/idkit";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { useAuth } from "@/src/contexts/AuthContext";
import { Bot, ShieldCheck, UserCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useReadContract } from "wagmi";
import { HUMAN_REGISTRY_ADDRESS, HUMAN_REGISTRY_ABI } from "@/src/config/contracts";
import { worldchainSepolia } from "@/wagmi-config";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const { isWorldIdVerified, isMiniKit, setVerified } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Primary Check: On-chain Verification (Instant Redirect)
  const { data: isVerifiedOnChain, isLoading: isLoadingOnChain } = useReadContract({
    address: HUMAN_REGISTRY_ADDRESS as `0x${string}`,
    abi: HUMAN_REGISTRY_ABI,
    functionName: "isVerified",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: worldchainSepolia.id,
    query: {
      enabled: mounted && isConnected && !!address && !isWorldIdVerified,
    }
  });

  useEffect(() => {
    if (isVerifiedOnChain && !isWorldIdVerified && address) {
      console.log("On-chain verification found, auto-verifying session.");
      setVerified({
        nullifier_hash: "onchain_" + address,
        verification_level: "device",
        proof: "",
        merkle_root: "",
        action: "onchain_sync"
      } as any, address);
      setCheckingStatus(false);
    }
  }, [isVerifiedOnChain, isWorldIdVerified, address, setVerified]);

  // Reset checking status when address changes
  useEffect(() => {
    if (mounted && address) {
      console.log("Wallet address changed, re-verifying:", address);
      setCheckingStatus(true);
      setError(null);
    }
  }, [mounted, address]);

  // Secondary Check: Backend Sync
  useEffect(() => {
    if (mounted && isConnected && address && !isWorldIdVerified) {
      console.log("Checking backend verification status for:", address);
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/verify/${address}`);
          if (!res.ok) {
            setCheckingStatus(false);
            return;
          }
          const result = await res.json();
          if (result.success && result.verified) {
            console.log("User already verified according to backend.");
            setVerified({
              nullifier_hash: `onchain_${address}`,
              verification_level: "device",
              proof: "",
              merkle_root: "",
            } as any, address);
          }
        } catch (err) {
          console.error("Failed to re-check verification status via backend:", err);
        } finally {
          setCheckingStatus(false);
        }
      };
      checkStatus();
    } else if (mounted && isWorldIdVerified) {
      setCheckingStatus(false);
    } else if (mounted && !isConnected) {
      setCheckingStatus(false);
    }
  }, [mounted, isConnected, address, isWorldIdVerified, setVerified]);

  if (!mounted) return null; // Prevent hydration mismatch

  // Show generic loading while checking verification status
  if (checkingStatus && isConnected && !isWorldIdVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-12 h-12 border-2 border-white animate-spin flex items-center justify-center">
             <div className="w-4 h-4 bg-white" />
          </div>
          <p className="text-white text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
            IDENTIFYING HUMAN...
          </p>
        </div>
      </div>
    );
  }

  const handleMiniKitVerify = async () => {
    if (!MiniKit.isInstalled()) return;
    setVerifying(true);
    setError(null);

    try {
      const action = process.env.NEXT_PUBLIC_WORLD_ACTION_ID!;
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: action,
        verification_level: [VerificationLevel.Orb, VerificationLevel.Device],
      });

      if (finalPayload.status === "error") {
        const code = (finalPayload as any).error_code ?? "unknown";
        if (code === "already_verified" || code === "max_verifications_reached") {
          setVerified(finalPayload as any, address || undefined);
          return;
        }
        setError(`Verification failed (${code}). Please try again.`);
        return;
      }

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: finalPayload, address }),
      });

      const result = await res.json();
      if (result.success) {
        setVerified(finalPayload as any, address || undefined);
      } else {
        setError(result.error || "Verification failed.");
      }
    } catch (err: any) {
      console.error("MiniKit verify error:", err);
      setError(err.message || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleBrowserVerify = async (result: IDKitResult) => {
    try {
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rp_id: rpContext!.rp_id,
          idkitResponse: result,
          address,
        }),
      });

      if (!res.ok) throw new Error("Backend verification failed");
      const responseData = await res.json();
      if (!responseData.success) throw new Error("World ID verification failed.");
      setVerified(result as any, address || undefined);
    } catch (err) {
      console.error("Verification process failed:", err);
      throw err;
    }
  };

  const handleOpenWidget = async () => {
    try {
      setVerifying(true);
      setError(null);

      const sigRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000'}/api/rp-signature`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: process.env.NEXT_PUBLIC_WORLD_ACTION_ID }),
      });

      if (!sigRes.ok) throw new Error("Failed to fetch RP signature");

      const sigData = await sigRes.json();
      setRpContext({
        rp_id: process.env.NEXT_PUBLIC_WORLD_RP_ID!,
        nonce: sigData.nonce,
        created_at: sigData.created_at,
        expires_at: sigData.expires_at,
        signature: sigData.sig,
      });

      setIsWidgetOpen(true);
    } catch (err: any) {
      console.error("Error setting up IDKit:", err);
      setError(err.message || "Failed to initialize verification");
    } finally {
      setVerifying(false);
    }
  };

  // Onboarding UI Wrapper
  const OnboardingLayout = ({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 md:p-6 overflow-hidden relative">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-sm border-2 border-white p-8 md:p-12 flex flex-col items-center text-center space-y-10 relative z-10 bg-black"
      >
        <div className="w-16 h-16 bg-white flex items-center justify-center">
          <span className="text-black font-black text-4xl">B</span>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tighter uppercase">
            {title}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-loose">
            {subtitle}
          </p>
        </div>

        <div className="w-full">
          {children}
        </div>
        
        <div className="pt-4 flex items-center gap-3 text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em]">
          <ShieldCheck size={12} />
          <span>Verified Person Protocol</span>
        </div>
      </motion.div>
    </div>
  );

  if (isMiniKit) {
    if (!isWorldIdVerified) {
      return (
        <OnboardingLayout 
          title="IDENTITY" 
          subtitle="Prove uniqueness via World ID to establish secure bridging tunnel."
        >
          <div className="w-full space-y-6">
            {error && <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">{error}</p>}
            <button
              onClick={handleMiniKitVerify}
              disabled={verifying}
              className="w-full py-5 bg-white text-black font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-zinc-200 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-30"
            >
              {verifying ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
              {verifying ? "VERIFYING..." : "WORLD APP VERIFY"}
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
        title="BLIP" 
        subtitle="Initialize wallet connection to access cross-chain liquidity."
      >
        <div className="flex justify-center w-full">
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="w-full py-5 bg-white text-black font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                Connect Signal
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
        title="SECURITY" 
        subtitle="Zero-knowledge proof required to prevent sybil infiltration."
      >
        <div className="w-full space-y-6">
          {error && <p className="text-[10px] text-red-600 font-black uppercase tracking-widest text-center">{error}</p>}
          <button
            onClick={handleOpenWidget}
            disabled={verifying}
            className="w-full py-5 bg-white text-black font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-zinc-200 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-30"
          >
            {verifying ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
            {verifying ? "SYNCING..." : "WORLD ID VERIFY"}
          </button>
          {rpContext && (
            <IDKitRequestWidget
              app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`}
              action={process.env.NEXT_PUBLIC_WORLD_ACTION_ID!}
              rp_context={rpContext}
              allow_legacy_proofs={true}
              preset={deviceLegacy()}
              open={isWidgetOpen}
              onOpenChange={setIsWidgetOpen}
              onSuccess={(result) => setVerified(result as any, address || undefined)}
              handleVerify={handleBrowserVerify}
            />
          )}
        </div>
      </OnboardingLayout>
    );
  }

  return <>{children}</>;
}

