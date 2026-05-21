"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { setCookie, getCookie } from "cookies-next";
import { Loader2, Mail, Lock, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CircleWalletSetupProps {
  onClose?: () => void;
}

type OnboardingState = "IDLE" | "AUTHENTICATING" | "CHALLENGE" | "RETRIEVING" | "SUCCESS" | "ERROR";

export default function CircleWalletSetup({ onClose }: CircleWalletSetupProps) {
  const { setWalletAddress } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<OnboardingState>("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [walletAddr, setWalletAddr] = useState("");
  const [challengeId, setChallengeId] = useState("");
  
  const sdkRef = useRef<any>(null);

  // Dynamic import of Circle Web SDK to ensure complete compatibility with Next.js SSR
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@circle-fin/w3s-pw-web-sdk").then(({ W3SSdk }) => {
        sdkRef.current = new W3SSdk();
        console.log("[Circle SDK] Dynamically initialized successfully");
      }).catch(err => {
        console.error("[Circle SDK] Dynamic loading failed:", err);
      });
    }
  }, []);

  const handleStartOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      setStatus("ERROR");
      return;
    }

    try {
      setStatus("AUTHENTICATING");
      setErrorMsg("");

      // Normalize userId persistently per email address
      const userId = `blip_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      // 1. Initialize user and get session credentials
      const initRes = await fetch("/api/circle/init-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error || "Failed to initialize user session");

      const { userToken, encryptionKey } = initData;

      // Persist credentials locally for contract executions
      localStorage.setItem("blip_circle_user_token", userToken);
      localStorage.setItem("blip_circle_encryption_key", encryptionKey);
      localStorage.setItem("blip_circle_user_id", userId);
      setCookie("blip_circle_token", userToken);

      // 2. Trigger SCA Wallet Creation Challenge
      const walletRes = await fetch("/api/circle/create-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Token": userToken,
        },
      });

      const walletData = await walletRes.json();
      if (!walletData.success) throw new Error(walletData.error || "Failed to create wallet challenge");

      const targetChallengeId = walletData.challengeId;
      setChallengeId(targetChallengeId);

      // 3. Configure Circle Web SDK
      const sdk = sdkRef.current;
      if (!sdk) {
        throw new Error("Circle SDK is not fully loaded yet. Please wait a moment and try again.");
      }

      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "351a6136-1c09-5a67-ab17-062fe81498b3"; // Fallback to sandbox app id if missing
      sdk.setAppId(appId);
      sdk.setAuthentication({ userToken, encryptionKey });

      // 4. Prompt client PIN setup challenge
      setStatus("CHALLENGE");
      sdk.execute(targetChallengeId, async (error: any, result: any) => {
        if (error) {
          console.error("Circle Challenge Error:", error);
          setErrorMsg(error.message || "Challenge execution rejected by user or cancelled.");
          setStatus("ERROR");
          return;
        }

        console.log("Circle Challenge Completed Successfully:", result);
        setStatus("RETRIEVING");

        // 5. Retrieve created wallet addresses from backend
        try {
          const fetchWalletRes = await fetch("/api/circle/wallet", {
            method: "GET",
            headers: {
              "X-User-Token": userToken,
            },
          });

          const fetchWalletData = await fetchWalletRes.json();
          if (!fetchWalletData.success || !fetchWalletData.wallets || fetchWalletData.wallets.length === 0) {
            throw new Error("Failed to index new wallet address from Circle API.");
          }

          // Fetch the first EVM SCA wallet address
          const primaryWallet = fetchWalletData.wallets[0];
          const newAddress = primaryWallet.address;
          const walletId = primaryWallet.id;

          localStorage.setItem("blip_circle_wallet_address", newAddress);
          localStorage.setItem("blip_circle_wallet_id", walletId);
          sessionStorage.setItem("blip_wallet_type", "circle");

          setWalletAddr(newAddress);
          setStatus("SUCCESS");

          // Delay setting the wallet address to let success animation play
          setTimeout(() => {
            setWalletAddress(newAddress);
            if (onClose) onClose();
          }, 2000);
        } catch (fetchErr: any) {
          console.error("Wallet Resolution Error:", fetchErr);
          setErrorMsg(fetchErr.message || "Failed to retrieve wallet information.");
          setStatus("ERROR");
        }
      });

    } catch (err: any) {
      console.error("Onboarding Flow Error:", err);
      setErrorMsg(err.message || "An unexpected error occurred during onboarding.");
      setStatus("ERROR");
    }
  };

  return (
    <div className="w-full max-w-md border-2 border-white p-6 md:p-8 flex flex-col space-y-6 bg-black relative z-10 text-center">
      <AnimatePresence mode="wait">
        {status === "IDLE" && (
          <motion.form
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleStartOnboarding}
            className="flex flex-col space-y-6"
          >
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 bg-white flex items-center justify-center rounded-none mb-2">
                <Mail className="text-black w-6 h-6" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Email Smart Account</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
                Create a secure, self-custodied wallet using social login. No seed phrase required.
              </p>
            </div>

            <div className="relative">
              <input
                type="email"
                placeholder="ENTER EMAIL ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border-2 border-zinc-800 focus:border-white px-4 py-4 text-xs font-mono text-center tracking-wider outline-none text-white transition-all uppercase placeholder-zinc-700"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-white text-black font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              Initialize Wallet
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border-2 border-zinc-800 text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:border-white hover:text-white active:scale-[0.98]"
              >
                Back to Wallets
              </button>
            )}
            
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest">
              Gas Sponsored by Blip Protocol on Base Sepolia
            </p>
          </motion.form>
        )}

        {status === "AUTHENTICATING" && (
          <motion.div
            key="authenticating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10 space-y-4"
          >
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em]">Creating User Session...</h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
              Registering secure Threshold Key components on Circle
            </p>
          </motion.div>
        )}

        {status === "CHALLENGE" && (
          <motion.div
            key="challenge"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10 space-y-4"
          >
            <Lock className="w-10 h-10 text-white animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em]">Secure PIN Challenge</h3>
            <p className="text-[9px] text-zinc-400 uppercase tracking-wider leading-relaxed px-4">
              Please complete the PIN & Security Questions setup in the secure pop-up overlay.
            </p>
          </motion.div>
        )}

        {status === "RETRIEVING" && (
          <motion.div
            key="retrieving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10 space-y-4"
          >
            <Shield className="w-10 h-10 text-white animate-spin" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em]">Generating Smart Account...</h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
              Syncing EVM address profiles across active testnets
            </p>
          </motion.div>
        )}

        {status === "SUCCESS" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-6 space-y-6"
          >
            <div className="w-12 h-12 bg-white flex items-center justify-center rounded-none">
              <CheckCircle className="text-black w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Wallet Activated!</h3>
              <p className="text-[8px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-900 px-3 py-2 rounded-none max-w-xs break-all">
                {walletAddr}
              </p>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
              Redirecting to bridging dashboard...
            </p>
          </motion.div>
        )}

        {status === "ERROR" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-4 space-y-6"
          >
            <div className="w-12 h-12 bg-red-600 flex items-center justify-center rounded-none">
              <AlertCircle className="text-white w-6 h-6" />
            </div>
            <div className="space-y-2 px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.15em] text-red-600">Onboarding Failed</h3>
              <p className="text-[9px] text-zinc-400 leading-relaxed uppercase">
                {errorMsg || "An unknown network error occurred."}
              </p>
            </div>
            
            <button
              onClick={() => setStatus("IDLE")}
              className="px-6 py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
