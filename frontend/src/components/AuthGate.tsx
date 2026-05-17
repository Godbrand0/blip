"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAuth } from "@/src/contexts/AuthContext";
import { motion } from "framer-motion";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const { isMiniKit, walletAddress, setWalletAddress } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isWalletConnected = isConnected || (isMiniKit && !!walletAddress);

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

      if (
        result.status === "error" ||
        result.executedWith === "fallback" ||
        (!result.commandPayload && !result.finalPayload && !result.data)
      ) {
        throw new Error("Wallet authentication failed");
      }

      const authPayload = result.finalPayload || result.commandPayload || result.data || result;
      setDebugPayload(JSON.stringify(authPayload, null, 2));

      if (!authPayload || (!authPayload.message && !authPayload.siweMessage)) {
        throw new Error("Payload missing 'message' or 'siweMessage'");
      }

      const siweRes = await fetch("/api/complete-siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: authPayload, nonce }),
      });

      if (!siweRes.ok) {
        const textMsg = await siweRes.text();
        throw new Error(`SIWE Backend failed: ${siweRes.status} ${textMsg.substring(0, 50)}`);
      }

      const data = await siweRes.json();
      if (!data.isValid) throw new Error(data.message || "SIWE payload is invalid");

      const returnedAddress = authPayload.address || (MiniKit as any).user?.walletAddress;
      if (returnedAddress) {
        sessionStorage.setItem("blip_wallet_address", returnedAddress);
        setWalletAddress(returnedAddress);
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate wallet");
    } finally {
      setAuthenticating(false);
    }
  };

  if (!isWalletConnected) {
    return (
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
            <h1 className="text-5xl font-black tracking-tighter uppercase">BLIP</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-loose">
              Initialize wallet connection to access cross-chain liquidity.
            </p>
          </div>

          <div className="flex justify-center w-full flex-col relative">
            {error && (
              <p className="text-[10px] text-red-600 font-black uppercase tracking-widest text-center mb-4 absolute -top-8 w-full">
                {error}
              </p>
            )}
            {debugPayload && (
              <pre className="text-[8px] text-zinc-400 overflow-auto h-24 mb-4 p-2 bg-zinc-900 border border-zinc-800 absolute -bottom-32 w-full z-20 text-left">
                {debugPayload}
              </pre>
            )}
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
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
