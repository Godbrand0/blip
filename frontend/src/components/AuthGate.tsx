"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  IDKitWidget,
  VerificationLevel,
  ISuccessResult,
} from "@worldcoin/idkit";
import { useAuth } from "@/src/contexts/AuthContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const { isWorldIdVerified, setVerified, walletAddress } = useAuth();

  const handleVerify = async (proof: ISuccessResult) => {
    console.log("Starting World ID verification process...");
    console.log("Proof data:", proof);
    console.log("Current wallet address:", address);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    console.log("Sending verification request to:", `${apiUrl}/api/verify`);

    try {
      const res = await fetch(`${apiUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });

      console.log("Verification response status:", res.status);
      const result = await res.json();
      console.log("Verification response data:", result);

      if (!res.ok) {
        console.error("Verification error details:", result);
        throw new Error(
          result?.details?.detail || result?.error || "Verification failed.",
        );
      }
      if (!result.success) throw new Error("World ID verification failed.");

      console.log("Verification successful!");
      
      // Handle the case where user was already verified
      if (result.already_verified) {
        console.log("User was already verified, setting verified status...");
        setVerified(proof);
      }
    } catch (error) {
      console.error("Verification process failed:", error);
      throw error;
    }
  };

  const onSuccess = (proof: ISuccessResult) => {
    console.log("World ID verification successful, setting verified status...");
    console.log("Proof:", proof);
    console.log("Associated wallet address:", address);
    setVerified(proof);
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to BLIP</h1>
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
            onSuccess={onSuccess}
            handleVerify={handleVerify}
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
