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

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const { isWorldIdVerified, isMiniKit, setVerified, walletAddress } =
    useAuth();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- MiniKit verify flow (inside World App) ---
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

      // Verify proof server-side via Next.js API route
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

  // --- IDKit verify flow (browser) ---
  const handleBrowserVerify = async (proof: ISuccessResult) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    try {
      const res = await fetch(`${apiUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(
          result?.details?.detail || result?.error || "Verification failed.",
        );
      }
      if (!result.success) throw new Error("World ID verification failed.");

      if (result.already_verified) {
        setVerified(proof);
      }
    } catch (err) {
      console.error("Verification process failed:", err);
      throw err;
    }
  };

  const onBrowserSuccess = (proof: ISuccessResult) => {
    setVerified(proof);
  };

  // --- MiniKit path: no wallet connect needed, World App provides wallet ---
  if (isMiniKit) {
    if (!isWorldIdVerified) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
          <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to BLIP
            </h1>
            <p className="text-zinc-400">
              Verify with World ID to access BLIP.
            </p>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              onClick={handleMiniKitVerify}
              disabled={verifying}
              className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify with World ID"}
            </button>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  // --- Browser path: wallet connect + IDKit ---
  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to BLIP
          </h1>
          <p className="text-zinc-400">Connect your wallet to get started.</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (!isWorldIdVerified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Verify Your Identity
          </h1>
          <p className="text-zinc-400 mb-2">
            Connected Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          <p className="text-zinc-400">Verify with World ID to access BLIP.</p>
          <IDKitWidget
            app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`}
            action={process.env.NEXT_PUBLIC_WORLD_ACTION_ID!}
            onSuccess={onBrowserSuccess}
            handleVerify={handleBrowserVerify}
            verification_level={VerificationLevel.Device}
          >
            {({ open }) => (
              <button
                onClick={open}
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-all hover:bg-blue-700"
              >
                Verify with World ID
              </button>
            )}
          </IDKitWidget>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
