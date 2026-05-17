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
  WORLD_CHAIN_USDC,
  BASE_SEPOLIA_USDC,
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
import { ArrowRightLeft, ArrowLeft, CheckCircle, Loader2, AlertCircle, Wallet, Repeat, Droplets } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useIntents } from "@/hooks/useIntents";
import { getSocket } from "@/lib/websocket";
import { ChatInterface } from "@/components/ChatInterface";

function usdcToRaw(amount: number): string {
  return BigInt(Math.round(amount * 1e6)).toString();
}

type Step = "input" | "approving" | "bridging" | "done" | "error";

export default function BridgePage() {
  return (
    <AuthGate>
      <BridgeForm />
      <ChatInterface />
    </AuthGate>
  );
}

function BridgeForm() {
  const { walletAddress, isMiniKit } = useAuth();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { chainId: currentChainId } = useAccount();
  const { addIntent } = useIntents(walletAddress);

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

  // WebSocket listener for real-time relay status updates
  useEffect(() => {
    if (!intentId) return;
    const socket = getSocket();
    if (!socket) return;

    const onRelaying = (data: { intentId: string }) => {
      if (data.intentId !== intentId) return;
      setRelayStatus("RELAYING");
    };
    const onCompleted = (data: { intentId: string; baseTxHash: string }) => {
      if (data.intentId !== intentId) return;
      setRelayStatus("COMPLETED");
      if (data.baseTxHash) setDestTxHash(data.baseTxHash);
    };
    const onFailed = (data: { intentId: string; error: string }) => {
      if (data.intentId !== intentId) return;
      setRelayStatus("FAILED");
      setErrorMsg(data.error || "Relay failed");
    };

    socket.on("intent-relaying", onRelaying);
    socket.on("intent-completed", onCompleted);
    socket.on("intent-failed", onFailed);

    return () => {
      socket.off("intent-relaying", onRelaying);
      socket.off("intent-completed", onCompleted);
      socket.off("intent-failed", onFailed);
    };
  }, [intentId]);

  // HTTP polling fallback for relay status (in case WebSocket event is missed)
  useEffect(() => {
    if (step !== "done" || !intentId) return;

    let active = true;
    let interval: ReturnType<typeof setInterval>;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/bridge/status/${intentId}`);
        const data = await res.json();
        if (!active) return;
        if (data.success) {
          setRelayStatus(data.status);
          if (data.destTxHash) setDestTxHash(data.destTxHash);
          if (data.status === "FAILED") setErrorMsg(data.error || "Relay failed");
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error("[CCTP] Status poll error:", e);
      }
    };

    // Immediate check (don't wait 5s for first poll)
    checkStatus();
    interval = setInterval(checkStatus, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, intentId]); // intentionally excludes relayStatus to avoid restarting interval on each status change

  // Fetch USDC balances using reliable RPC clients
  const [sourceUsdcBalRaw, setSourceUsdcBalRaw] = useState<bigint>(BigInt(0));
  const [destUsdcBalRaw, setDestUsdcBalRaw] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (!walletAddress) return;
    const fetchUsdc = async () => {
      try {
        // Fetch each chain's balance using its dedicated client/address
        const [worldBal, baseBal] = await Promise.all([
          wcPublicClient.readContract({
            address: WORLD_CHAIN_USDC as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          }),
          basePublicClient.readContract({
            address: BASE_SEPOLIA_USDC as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          }),
        ]);

        // Map the results back to source/dest based on the current direction
        const isWorldToBase = sourceChainId === 4801;
        setSourceUsdcBalRaw(isWorldToBase ? (worldBal as bigint) : (baseBal as bigint));
        setDestUsdcBalRaw(isWorldToBase ? (baseBal as bigint) : (worldBal as bigint));
      } catch (e) {
        console.error("[CCTP] Bridge balance sync error:", e);
      }
    };
    fetchUsdc();
    const id = setInterval(fetchUsdc, 10000);
    return () => clearInterval(id);
  }, [walletAddress, sourceChainId]); // Dependencies on walletAddress and direction (sourceChainId)

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
    if (!isValid) return;

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

        console.log(`[CCTP] Starting bridge relay (MiniKit): ${sourceChainId} -> ${destChainId}`);

        // Relay via backend
        const response = await fetch("/api/bridge/relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash,
            user: walletAddress,
            amount: rawAmount,
            recipient,

            recordId: _recordId,
            sourceChain: sourceChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
            destChain: destChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
          }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Bridge relay registration failed");
        
        // Add to local store for immediate history matching
        addIntent({
          intentId: result.intentId,
          amount: parsedAmount,
          recipient,
          status: "PENDING",
          burnTxHash: txHash,
          sourceTxHash: txHash,
          sourceChain: sourceChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
          destChain: destChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
        });

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
            0, // Standard Transfer (to avoid gas estimation revert)
          ],
          account: walletAddress as `0x${string}`,
          chain: sourcePublicClient.chain,
          gas: BigInt(500000), // Manual gas limit to bypass RPC estimation error
        });

        setBridgeTxHash(burnHash);
        await sourcePublicClient.waitForTransactionReceipt({ hash: burnHash });

        // Record on-chain (non-blocking)
        const recordId = await recordOnChain(burnHash, rawAmount);

        console.log(`[CCTP] Starting bridge relay (Web Wallet): ${sourceChainId} -> ${destChainId}`);

        // Relay via backend
        const response = await fetch("/api/bridge/relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: burnHash,
            user: walletAddress,
            amount: rawAmount,
            recipient,

            recordId,
            sourceChain: sourceChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
            destChain: destChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
          }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Bridge relay registration failed");
        
        // Add to local store for immediate history matching
        addIntent({
          intentId: result.intentId,
          amount: parsedAmount,
          recipient,
          status: "PENDING",
          burnTxHash: burnHash,
          sourceTxHash: burnHash,
          sourceChain: sourceChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
          destChain: destChainId === 4801 ? 'WORLD_CHAIN' : 'BASE_SEPOLIA',
        });

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
    <div className="min-h-[100dvh] w-full bg-black text-white selection:bg-white selection:text-black">
      {/* Pure B&W background */}
      
      <main className="relative z-10 w-full max-w-3xl mx-auto p-6 md:p-10 pb-32">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12 border-b-2 border-white pb-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="w-12 h-12 border-2 border-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Bridge</h1>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">
                QUANTUM TUNNEL ACTIVE
              </p>
            </div>
          </div>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest transition-all hover:bg-zinc-200 active:scale-95 border-2 border-white"
          >
            <Droplets size={14} />
            USDC Faucet
          </a>
        </header>

        {/* Direction Switcher - Brutalist Grid */}
        <div className="relative mb-12">
          <div className="grid grid-cols-2 gap-px bg-white border-2 border-white">
            <div className="bg-black p-8 flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Origin</span>
              <span className="text-2xl font-black uppercase tracking-tighter">{sourceConfig.name}</span>
              <div className="mt-4 flex flex-col gap-1">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Available Allocation:</span>
                <span className="text-sm font-black mono">{sourceUsdcBalance.toFixed(2)} USDC</span>
              </div>
            </div>
            <div className="bg-black p-8 flex flex-col gap-3 border-l-2 border-white">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Destination</span>
              <span className="text-2xl font-black uppercase tracking-tighter">{destConfig.name}</span>
              <div className="mt-4 flex flex-col gap-1">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Target Balance:</span>
                <span className="text-sm font-black mono">{destUsdcBalance.toFixed(2)} USDC</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleSwitchDirection}
            disabled={step !== 'input'}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white text-black border-4 border-black flex items-center justify-center hover:rotate-180 transition-all duration-500 z-20 disabled:opacity-50"
          >
            <Repeat size={20} strokeWidth={3} />
          </button>
        </div>

        {step === "input" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-10"
          >
            {/* Input Panel */}
            <div className="border-2 border-white p-10 space-y-10">
              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                  Transaction Magnitude (USDC)
                </label>
                <div className="relative border-b-4 border-white pb-4">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    className="w-full bg-transparent text-7xl font-black text-white placeholder:text-zinc-900 outline-none mono"
                  />
                  <button
                    onClick={() => setAmount(Math.max(0, sourceUsdcBalance - 0.1).toFixed(6))}
                    className="absolute right-0 bottom-4 text-[10px] font-black uppercase tracking-widest bg-white text-black px-4 py-2 hover:invert transition-all"
                  >
                    MAX CAP
                  </button>
                </div>
                {(parsedAmount + 0.1) > sourceUsdcBalance && (
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] animate-pulse">
                    [WARNING] INSUFFICIENT COLLATERAL (0.10 REQUIRED)
                  </p>
                )}
              </div>

              <div className="space-y-6 pt-10 border-t-2 border-zinc-900">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                  Recipient Identity Probe
                </label>
                <div className="flex gap-px bg-white border border-white">
                  <button
                    onClick={() => setUseMyWallet(true)}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      useMyWallet ? "bg-white text-black" : "bg-black text-zinc-500 hover:text-white"
                    }`}
                  >
                    Current Proxy
                  </button>
                  <button
                    onClick={() => setUseMyWallet(false)}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      !useMyWallet ? "bg-white text-black" : "bg-black text-zinc-500 hover:text-white"
                    }`}
                  >
                    Custom Target
                  </button>
                </div>

                {!useMyWallet && (
                  <input
                    type="text"
                    value={customRecipient}
                    onChange={(e) => setCustomRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-zinc-950 border-2 border-white px-6 py-5 text-sm font-mono text-white placeholder:text-zinc-800 outline-none focus:bg-black transition-all"
                  />
                )}
              </div>
            </div>

            {/* Metrics Checklist */}
            <div className="bg-zinc-950 border-2 border-white p-8 space-y-6 border-l-8">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em]">
                <span className="text-zinc-600">Protocol Service Fee</span>
                <span className="text-white">0.10 USDC</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em]">
                <span className="text-zinc-600">Network Gas Friction</span>
                <span className="text-white">&lt; 0.001 ETH</span>
              </div>
              <div className="pt-6 border-t border-zinc-800 flex justify-between items-center text-[11px] font-black uppercase tracking-[0.4em]">
                <span className="text-zinc-400">Net Deduction</span>
                <span className="text-white">{(parsedAmount + 0.1).toFixed(2)} USDC</span>
              </div>
            </div>

            <button
              onClick={handleBridge}
              disabled={!isValid}
              className="group relative w-full py-8 bg-white text-black font-black text-2xl uppercase tracking-[0.3em] transition-all hover:bg-black hover:text-white border-4 border-white active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed overflow-hidden"
            >
              <span className="relative z-10 transition-transform group-hover:scale-110 block">
                Execute Bridge Intent
              </span>
            </button>
          </motion.div>
        )}

        {step === "approving" && (
          <div className="border-4 border-white p-16 flex flex-col items-center text-center space-y-10 bg-zinc-950">
            <div className="w-24 h-24 border-8 border-white border-t-transparent animate-spin flex items-center justify-center">
               <div className="w-4 h-4 bg-white" />
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl font-black uppercase tracking-[0.1em]">Identity Lock</h2>
              <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.4em] leading-relaxed max-w-sm">
                Awaiting cryptographic authorization from your local terminal.
              </p>
            </div>
          </div>
        )}

        {step === "bridging" && (
          <div className="border-4 border-white p-16 flex flex-col items-center text-center space-y-10 bg-black">
            <div className="w-full h-4 bg-zinc-900 border-2 border-white relative overflow-hidden">
              <motion.div 
                initial={{ left: "-100%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-y-0 w-1/3 bg-white"
              />
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl font-black uppercase tracking-[0.1em]">Tunneling</h2>
              <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.4em] leading-relaxed">
                Assets migrating through cross-chain liquidity layers.
              </p>
              {bridgeTxHash && (
                <div className="mt-8 p-4 border border-zinc-800 bg-zinc-950">
                   <p className="text-[9px] font-mono text-zinc-400 break-all select-all">{bridgeTxHash}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="border-4 border-white p-16 flex flex-col items-center text-center space-y-12 bg-black">
              {relayStatus === "COMPLETED" ? (
                <div className="w-24 h-24 bg-white text-black flex items-center justify-center">
                  <CheckCircle size={48} strokeWidth={3} />
                </div>
              ) : relayStatus === "FAILED" ? (
                <div className="w-24 h-24 border-4 border-white flex items-center justify-center">
                  <AlertCircle size={48} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-24 h-24 border-8 border-white border-t-transparent animate-spin flex items-center justify-center">
                   <div className="w-4 h-4 bg-white" />
                </div>
              )}
  
              <div className="space-y-6">
                <h2 className="text-5xl font-black uppercase tracking-tighter">
                  {relayStatus === "COMPLETED" ? "SUCCESS" : relayStatus === "FAILED" ? "FAILED" : "PENDING"}
                </h2>
                <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.3em] leading-loose max-w-sm">
                  {relayStatus === "COMPLETED" 
                    ? `Quantized assets successfully reconstructed on ${destConfig.name}.`
                    : relayStatus === "FAILED"
                    ? errorMsg
                    : "CCTP handshake established. Finality achieved in 5-10m."}
                </p>
              </div>

              <div className="w-full flex flex-col gap-2">
                {bridgeTxHash && (
                  <a
                    href={`${sourceConfig.explorer}/tx/${bridgeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-6 border-2 border-white hover:bg-white hover:text-black transition-all group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 group-hover:text-black">Source Node</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 underline">
                       EXPLORE
                    </span>
                  </a>
                )}
                {destTxHash && (
                  <a
                    href={`${destConfig.explorer}/tx/${destTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-6 border-2 border-white hover:bg-white hover:text-black transition-all group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 group-hover:text-black">Target Node</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 underline">
                       EXPLORE
                    </span>
                  </a>
                )}
              </div>

              <button
                onClick={reset}
                className="w-full py-6 bg-white text-black font-black text-[12px] uppercase tracking-[0.5em] hover:bg-zinc-200 transition-all border-4 border-white"
              >
                RETURN TO COMMAND
              </button>
            </div>
          </motion.div>
        )}

        {step === "error" && (
           <div className="border-4 border-white bg-black p-16 flex flex-col items-center text-center space-y-10">
             <div className="text-white">
               <AlertCircle size={64} strokeWidth={3} />
             </div>
             <div className="space-y-6">
               <h2 className="text-4xl font-black uppercase tracking-tighter">PROTOCOL ERROR</h2>
               <div className="bg-zinc-950 p-6 border border-zinc-800">
                 <p className="text-[11px] text-zinc-500 font-mono break-all leading-relaxed">{errorMsg}</p>
               </div>
             </div>
             <button
                onClick={reset}
                className="w-full py-6 bg-white text-black text-[11px] font-black uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all"
              >
                ABORT & RE-INITIALIZE
              </button>
           </div>
        )}
      </main>
    </div>
  );
}
