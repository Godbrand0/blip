"use client";

import { useState, useEffect } from "react";
import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/contexts/AuthContext";
import { useReadContract, useSwitchChain, useAccount, useWalletClient } from "wagmi";
import { createPublicClient, http, fallback, formatUnits, erc20Abi } from "viem";
import { MiniKit } from "@worldcoin/minikit-js";
import {
  CHAIN_CONFIGS,
  TOKEN_MESSENGER_ABI,
  ERC20_ABI,
} from "@/src/config/contracts";
import { worldchainSepolia } from "@/wagmi-config";
import { baseSepolia } from "wagmi/chains";

// Custom public clients backed by reliable RPCs, bypassing wagmi's transport config
const wcPublicClient = createPublicClient({
  chain: worldchainSepolia,
  transport: fallback([
    http("https://worldchain-sepolia.drpc.org"),
    http("https://worldchain-sepolia.gateway.tenderly.co"),
    http("https://4801.rpc.thirdweb.com"),
    http("https://worldchain-sepolia.g.alchemy.com/public"),
  ]),
});
const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback([
    http("https://sepolia.base.org"),
    http("https://base-sepolia.drpc.org"),
    http("https://base-sepolia.gateway.tenderly.co"),
  ]),
});
import { ArrowRightLeft, ArrowLeft, CheckCircle, Loader2, AlertCircle, Wallet, Repeat } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function usdcToRaw(amount: number): string {
  return BigInt(Math.round(amount * 1e6)).toString();
}

type Step = "input" | "approving" | "bridging" | "done" | "error";

export default function BridgePage() {
  return (
    <AuthGate>
      <BridgeForm />
    </AuthGate>
  );
}

function BridgeForm() {
  const { walletAddress, isMiniKit, isWorldIdVerified, worldIdProof } = useAuth();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { chainId: currentChainId } = useAccount();

  const [sourceChainId, setSourceChainId] = useState<number>(worldchainSepolia.id);
  const [destChainId, setDestChainId] = useState<number>(baseSepolia.id);
  
  const sourceConfig = CHAIN_CONFIGS[sourceChainId];
  const destConfig = CHAIN_CONFIGS[destChainId];

  const sourcePublicClient = sourceChainId === worldchainSepolia.id ? wcPublicClient : basePublicClient;

  const [amount, setAmount] = useState("");
  const [useMyWallet, setUseMyWallet] = useState(true);
  const [customRecipient, setCustomRecipient] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [relayStatus, setRelayStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Polling for relay status
  useEffect(() => {
    if (step === "done" && intentId && relayStatus !== "COMPLETED" && relayStatus !== "FAILED") {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/bridge/status/${intentId}`);
          const data = await res.json();
          if (data.success) {
            setRelayStatus(data.status);
            if (data.destTxHash) setDestTxHash(data.destTxHash);
            if (data.status === "FAILED") setErrorMsg(data.error || "Relay failed");
          }
        } catch (e) {
          console.error("[CCTP] Status poll error:", e);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [step, intentId, relayStatus]);

  // Fetch USDC balances using reliable RPC clients
  const [sourceUsdcBalRaw, setSourceUsdcBalRaw] = useState<bigint>(BigInt(0));
  const [destUsdcBalRaw, setDestUsdcBalRaw] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (!walletAddress) return;
    const fetchUsdc = async () => {
      try {
        const [sBal, dBal] = await Promise.all([
          wcPublicClient.readContract({
            address: sourceConfig.usdc as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          }),
          basePublicClient.readContract({
            address: destConfig.usdc as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          }),
        ]);
        setSourceUsdcBalRaw(sBal as bigint);
        setDestUsdcBalRaw(dBal as bigint);
      } catch (e) {
        console.error("[CCTP] Bridge balance sync error:", e);
      }
    };
    fetchUsdc();
    const id = setInterval(fetchUsdc, 10000);
    return () => clearInterval(id);
  }, [walletAddress, sourceConfig.usdc, destConfig.usdc]);

  const sourceUsdcBalance = parseFloat(formatUnits(sourceUsdcBalRaw, 6));
  const destUsdcBalance = parseFloat(formatUnits(destUsdcBalRaw, 6));

  const recipient = useMyWallet ? walletAddress! : customRecipient.trim();
  const parsedAmount = parseFloat(amount);
  const FEE_AMOUNT_DISPLAY = 0.1;
  const isValid =
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (parsedAmount + FEE_AMOUNT_DISPLAY) <= sourceUsdcBalance &&
    (useMyWallet || /^0x[0-9a-fA-F]{40}$/.test(customRecipient.trim()));

  const handleAddToken = async (chainId: number) => {
    if (!(window as any).ethereum) return;
    const config = CHAIN_CONFIGS[chainId];
    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: config.usdc,
            symbol: 'USDC',
            decimals: 6,
          },
        },
      });
    } catch (e) {
      console.error('[CCTP] Error adding token:', e);
    }
  };

  const handleSwitchDirection = () => {
    const oldSource = sourceChainId;
    setSourceChainId(destChainId);
    setDestChainId(oldSource);
    setAmount("");
  };

  // recordOnChain is now handled by the backend relay service to avoid
  // MetaMask RPC rate-limit issues. This is a no-op kept for reference.
  const recordOnChain = async (_burnTxHashHex: string, _rawAmount: string): Promise<string | null> => null;

  const handleBridge = async () => {
    if (!isValid || !isWorldIdVerified) return;

    // Ensure we are on the correct Source Chain
    if (currentChainId !== sourceChainId) {
      try {
        await switchChainAsync({ chainId: sourceChainId });
        return; // Wait for user to trigger again or handle auto-resume
      } catch (e) {
        console.error('[CCTP] Network switch error:', e);
        setErrorMsg(`Network switch failed. Please switch to ${sourceConfig.name} manually.`);
        setStep('error');
        return;
      }
    }

    setStep("approving");
    setErrorMsg(null);

    try {
      const rawAmount = usdcToRaw(parsedAmount);
      const recipientBytes32 = `0x${recipient.slice(2).padStart(64, "0")}` as `0x${string}`;
      const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      setStep("approving");

      let currentAllowance = BigInt(0);
      try {
        currentAllowance = await sourcePublicClient.readContract({
          address: sourceConfig.usdc as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [walletAddress as `0x${string}`, sourceConfig.tokenMessenger as `0x${string}`],
        }) as bigint;
        console.log("[CCTP] Current allowance:", currentAllowance.toString());
      } catch (e) {
        console.error("[CCTP] Error checking allowance:", e);
      }

      const FEE_AMOUNT = BigInt(100000); // 0.1 USDC
      const totalNeeded = BigInt(rawAmount) + FEE_AMOUNT;
      const needsApproval = currentAllowance < totalNeeded;

      if (isMiniKit) {
        if (needsApproval) {
          console.log("[CCTP] Requesting approval via MiniKit...");
          const approveRes = await MiniKit.commandsAsync.sendTransaction({
            transaction: [
              {
                address: sourceConfig.usdc as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [sourceConfig.tokenMessenger as `0x${string}`, rawAmount],
              },
            ],
          });

          if (approveRes.finalPayload.status === "error") throw new Error("Approval failed or cancelled");
          
          const approveHash = approveRes.finalPayload.transaction_id;
          if (approveHash) {
            console.log("[CCTP] Waiting for approval mining:", approveHash);
            await sourcePublicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
          }
        }

        setStep("bridging");

        // Burn
        const burnRes = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: sourceConfig.tokenMessenger as `0x${string}`,
              abi: TOKEN_MESSENGER_ABI,
              functionName: "depositForBurn",
              args: [
                rawAmount,
                destConfig.domain,
                recipientBytes32,
                sourceConfig.usdc as `0x${string}`,
                zeroBytes32, // destinationCaller
                "100000", // maxFee (0.1 USDC) - REQUIRED for V2 on World Chain
                1000, // minFinalityThreshold
              ],
            },
          ],
        });

        if (burnRes.finalPayload.status === "error") throw new Error("Bridge transaction failed or cancelled");
        
        const txHash = burnRes.finalPayload.transaction_id;
        setBridgeTxHash(txHash);

        // Record on-chain (non-blocking; MiniKit can't parse return value, pass null)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _recordId = await recordOnChain(txHash, rawAmount);

        // Relay via backend
        const response = await fetch("/api/bridge/relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash,
            user: walletAddress,
            amount: rawAmount,
            recipient,
            proof: worldIdProof,
            recordId: _recordId,
            sourceChain: sourceChainId === worldchainSepolia.id ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
            destChain: destChainId === worldchainSepolia.id ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
          }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Bridge relay registration failed");
        setIntentId(result.intentId);
        setStep("done");

      } else {
        if (!walletClient) throw new Error("Wallet not connected");

        if (needsApproval) {
          console.log("[CCTP] Requesting approval via Web Wallet...");
          const approveHash = await walletClient.writeContract({
            address: sourceConfig.usdc as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [sourceConfig.tokenMessenger as `0x${string}`, BigInt(rawAmount) + BigInt(100000)],
            account: walletAddress as `0x${string}`,
            chain: sourcePublicClient.chain,
          });

          setApproveTxHash(approveHash);
          await sourcePublicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 120_000 });
        }

        setStep("bridging");

        const burnHash = await walletClient.writeContract({
          address: sourceConfig.tokenMessenger as `0x${string}`,
          abi: TOKEN_MESSENGER_ABI,
          functionName: "depositForBurn",
          args: [
            BigInt(rawAmount),
            destConfig.domain,
            recipientBytes32,
            sourceConfig.usdc as `0x${string}`,
            zeroBytes32,
            BigInt(100000), // maxFee (0.1 USDC)
            1000, // Fast Transfer
          ],
          account: walletAddress as `0x${string}`,
          chain: sourcePublicClient.chain,
        });

        setBridgeTxHash(burnHash);
        await sourcePublicClient.waitForTransactionReceipt({ hash: burnHash });

        // Record on-chain (non-blocking)
        const recordId = await recordOnChain(burnHash, rawAmount);

        // Relay via backend
        const response = await fetch("/api/bridge/relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: burnHash,
            user: walletAddress,
            amount: rawAmount,
            recipient,
            proof: worldIdProof,
            recordId,
            sourceChain: sourceChainId === worldchainSepolia.id ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
            destChain: destChainId === worldchainSepolia.id ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
          }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Bridge relay registration failed");
        setIntentId(result.intentId);
        setStep("done");
      }
    } catch (err: any) {
      console.error("[CCTP] Bridge error:", err);
      setErrorMsg(err.message || "Unknown error");
      setStep("error");
    }
  };

  const reset = () => {
    setStep("input");
    setAmount("");
    setCustomRecipient("");
    setUseMyWallet(true);
    setApproveTxHash(null);
    setBridgeTxHash(null);
    setDestTxHash(null);
    setIntentId(null);
    setRelayStatus(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white selection:bg-indigo-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-lg mx-auto flex flex-col p-6 pb-32">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8 pt-4">
          <Link
            href="/"
            className="w-10 h-10 bg-glass-hover border border-glass-border rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={18} className="text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Bridge</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {sourceConfig.name} → {destConfig.name}
            </p>
          </div>
        </header>

        {/* Persisted Balances & Route */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel border border-glass-border rounded-2xl p-4 flex flex-col gap-1 relative group">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {sourceConfig.name}
              </span>
              <span className="text-sm font-black text-white">
                {sourceUsdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
              </span>
              <button 
                onClick={() => handleAddToken(sourceChainId)}
                className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-widest text-indigo-400"
              >
                + Wallet
              </button>
            </div>
            <div className="glass-panel border border-glass-border rounded-2xl p-4 flex flex-col gap-1 relative group">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {destConfig.name}
              </span>
              <span className="text-sm font-black text-white">
                {destUsdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
              </span>
              <button 
                onClick={() => handleAddToken(destChainId)}
                className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-widest text-indigo-400"
              >
                + Wallet
              </button>
            </div>
          </div>

          <div className="relative glass-panel border border-glass-border rounded-2xl p-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500">From</span>
              <span className="text-white">{sourceConfig.name}</span>
            </div>
            
            <button 
              onClick={handleSwitchDirection}
              disabled={step !== 'input'}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-600 border-4 border-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20 disabled:opacity-50 disabled:grayscale"
            >
              <Repeat size={14} className="text-white" />
            </button>

            <div className="flex flex-col gap-1 text-right">
              <span className="text-zinc-500">To</span>
              <span className="text-white">{destConfig.name}</span>
            </div>
          </div>
        </div>

        {step === "input" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Amount */}
            <div className="glass-card p-6 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full bg-transparent text-3xl font-black text-white placeholder:text-zinc-700 outline-none pr-16"
                />
                <button
                  onClick={() => setAmount(Math.max(0, sourceUsdcBalance - 0.1).toFixed(6))}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Max (inc. fee)
                </button>
              </div>
              {(parsedAmount + 0.1) > sourceUsdcBalance && (
                <p className="text-[10px] text-red-400 font-bold">Exceeds balance (requires 0.1 USDC fee)</p>
              )}
            </div>

            {/* Recipient */}
            <div className="glass-card p-6 space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Recipient on Base Sepolia
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setUseMyWallet(true)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    useMyWallet
                      ? "bg-indigo-600 text-white"
                      : "bg-glass-hover border border-glass-border text-zinc-400 hover:border-indigo-500/30"
                  }`}
                >
                  <Wallet size={12} />
                  My Wallet
                </button>
                <button
                  onClick={() => setUseMyWallet(false)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    !useMyWallet
                      ? "bg-indigo-600 text-white"
                      : "bg-glass-hover border border-glass-border text-zinc-400 hover:border-indigo-500/30"
                  }`}
                >
                  Custom
                </button>
              </div>

              {useMyWallet ? (
                <p className="text-xs font-mono text-zinc-500 truncate">{walletAddress}</p>
              ) : (
                <input
                  type="text"
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-glass-hover border border-glass-border rounded-xl px-4 py-3 text-xs font-mono text-white placeholder:text-zinc-700 outline-none focus:border-indigo-500/50 transition-colors"
                />
              )}
            </div>

            {/* Fee Breakdown */}
            <div className="glass-panel border border-glass-border rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-zinc-500">CCTP Bridge Fee</span>
                <span className="text-indigo-400">0.10 USDC</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-zinc-500">Network Gas (Est.)</span>
                <span className="text-white">&lt; 0.001 ETH</span>
              </div>
              <div className="pt-2 mt-2 border-t border-glass-border flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-zinc-400">Total to be Deducted</span>
                <span className="text-white">
                  {(parsedAmount + 0.1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </span>
              </div>
            </div>

            <button
              onClick={handleBridge}
              disabled={!isValid}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Bridge via CCTP
            </button>
          </motion.div>
        )}

        {/* ... (Keep approving/bridging steps) ... */}

        {step === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-10 flex flex-col items-center text-center space-y-6"
          >
            {relayStatus === "COMPLETED" ? (
              <CheckCircle size={48} className="text-green-400" />
            ) : relayStatus === "FAILED" ? (
              <AlertCircle size={48} className="text-red-400" />
            ) : (
              <Loader2 size={48} className="text-indigo-400 animate-spin" />
            )}

            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-tight uppercase">
                {relayStatus === "COMPLETED" ? "Transfer Complete!" : relayStatus === "FAILED" ? "Relay Failed" : "Bridging in Progress..."}
              </h2>
              <p className="text-xs text-zinc-400 font-medium">
                {relayStatus === "COMPLETED" 
                  ? `${parsedAmount} USDC has arrived on Base Sepolia.`
                  : relayStatus === "FAILED"
                  ? errorMsg
                  : "CCTP is relaying your USDC. This usually takes 5-10 minutes."}
              </p>
            </div>

            <div className="w-full flex flex-col gap-3">
              {bridgeTxHash && (
                <a
                  href={`${sourceConfig.explorer}/tx/${bridgeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400">Source: {sourceConfig.name}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">View Tx →</span>
                </a>
              )}
              {destTxHash ? (
                <a
                  href={`${destConfig.explorer}/tx/${destTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400">Dest: {destConfig.name}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">View Tx →</span>
                </a>
              ) : relayStatus !== "FAILED" && (
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl opacity-50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dest: {destConfig.name}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pending...</span>
                </div>
              )}
            </div>

            <button
              onClick={reset}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.01] transition-all"
            >
              Bridge Again
            </button>
          </motion.div>
        )}

        {step === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-10 flex flex-col items-center text-center space-y-6"
          >
            <AlertCircle size={48} className="text-red-400" />
            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-tight uppercase">Bridge Failed</h2>
              <p className="text-xs text-red-400 font-mono break-all">{errorMsg}</p>
            </div>
            <button
              onClick={reset}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.01] transition-all"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
