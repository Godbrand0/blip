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
  const { isWorldIdVerified, isMiniKit, setVerified, walletAddress, setWalletAddress } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

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

  const isWalletConnected = isConnected || (isMiniKit && !!walletAddress);

  // Show generic loading while checking verification status
  if (checkingStatus && isWalletConnected && !isWorldIdVerified) {
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

  const handleBrowserVerify = async (verifyPayload: any) => {
    try {
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rp_id: rpContext?.rp_id || process.env.NEXT_PUBLIC_WORLD_RP_ID || process.env.NEXT_PUBLIC_WORLD_APP_ID,
          idkitResponse: verifyPayload,
          address: address || walletAddress,
        }),
      });

      if (!res.ok) {
        let errMsg = "Backend verification failed";
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.error || errData.message || errMsg;
        } catch {
          errMsg = await res.text() || errMsg;
        }
        throw new Error(`Verification rejected: ${errMsg.substring(0, 100)}`);
      }
      const responseData = await res.json();
      if (!responseData.success) throw new Error("World ID verification failed.");
      setVerified(verifyPayload as any, (address || walletAddress) || undefined);
    } catch (err) {
      console.error("Verification process failed:", err);
      throw err;
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      setError(null);

      if (isMiniKit) {
        const payload = {
            action: process.env.NEXT_PUBLIC_WORLD_ACTION_ID!,
            signal: address || walletAddress || "",
            verification_level: VerificationLevel.Device,
        };
        let result: any;
        if ((MiniKit as any).commandsAsync?.verify) {
            result = await (MiniKit as any).commandsAsync.verify(payload);
        } else {
            result = await (MiniKit.commands as any).verify(payload);
        }
        
        if (result.status === "error") {
            throw new Error("World ID Verification failed in World App");
        }
        
        const basePayload = result.finalPayload || result.commandPayload || result.data || result;
        if (!basePayload) throw new Error("No verification payload received");
        
        const verifyPayload = {
            ...basePayload,
            action: process.env.NEXT_PUBLIC_WORLD_ACTION_ID!,
            signal: address || walletAddress || "",
        };
        
        await handleBrowserVerify(verifyPayload);
      } else {
        const sigRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/rp-signature`, {
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
      }
    } catch (err: any) {
      console.error("Error setting up verification:", err);
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

  const handleMiniKitAuth = async () => {
    try {
      setAuthenticating(true);
      setError(null);
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

      if (result.status === "error" || result.executedWith === "fallback" || (!result.commandPayload && !result.finalPayload && !result.data)) {
        throw new Error("Wallet authentication failed");
      }

      const authPayload = result.finalPayload || result.commandPayload || result.data || result;
      setDebugPayload(JSON.stringify(authPayload, null, 2));

      if (!authPayload || (!authPayload.message && !authPayload.siweMessage)) {
          throw new Error("Payload missing 'message' or 'siweMessage'");
      }

      const siweRes = await fetch("/api/complete-siwe", { 
        method: "POST", 
        headers: { "Content-Type": "application/json", }, 
        body: JSON.stringify({ payload: authPayload, nonce }), 
      });
      
      if (!siweRes.ok) {
          const textMsg = await siweRes.text();
          throw new Error(`SIWE Backend failed: ${siweRes.status} ${textMsg.substring(0, 50)}`);
      }
      
      const data = await siweRes.json();
      if (!data.isValid) throw new Error(data.message || "SIWE payload is invalid");
      
      const returnedAddress = (authPayload.address || (MiniKit as any).user?.walletAddress);
      
      if (returnedAddress) {
        sessionStorage.setItem("blip_wallet_address", returnedAddress);
        setWalletAddress(returnedAddress);
      }
    } catch(err: any) {
      setError(err.message || "Failed to authenticate wallet");
    } finally {
      setAuthenticating(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <OnboardingLayout 
        title="BLIP" 
        subtitle="Initialize wallet connection to access cross-chain liquidity."
      >
        <div className="flex justify-center w-full flex-col relative">
          {error && <p className="text-[10px] text-red-600 font-black uppercase tracking-widest text-center mb-4 absolute -top-8 w-full">{error}</p>}
          {debugPayload && <pre className="text-[8px] text-zinc-400 overflow-auto h-24 mb-4 p-2 bg-zinc-900 border border-zinc-800 absolute -bottom-32 w-full z-20 text-left">{debugPayload}</pre>}
          {isMiniKit ? (
            <button
               onClick={handleMiniKitAuth}
               disabled={authenticating}
               className="w-full py-5 bg-white text-black font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
            >
               {authenticating ? "CONNECTING..." : "Connect Signal"}
            </button>
          ) : (
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
          )}
        </div>
      </OnboardingLayout>
    );
  }

  return <>{children}</>;
}

