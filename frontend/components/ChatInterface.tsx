"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Loader2, ExternalLink,
  CheckCircle, X, Sparkles, Wallet, AlertCircle, ArrowRightLeft
} from 'lucide-react';
import { useIntents } from '@/hooks/useIntents';
import { MiniKit } from '@worldcoin/minikit-js';
import { useAuth } from '@/src/contexts/AuthContext';
import { usePublicClient, useWalletClient, useWriteContract, useAccount, useSwitchChain } from 'wagmi';
import { createPublicClient, http, fallback, formatEther, parseUnits, erc20Abi } from 'viem';
import {
  USDC_ADDRESS,
  TOKEN_MESSENGER_ADDRESS,
  TOKEN_MESSENGER_ABI,
  BASE_SEPOLIA_DOMAIN,
  ERC20_ABI,
  CHAIN_CONFIGS,
  WORLD_CHAIN_USDC,
} from '@/src/config/contracts';
import { getSocket } from '@/lib/websocket';
import { worldchainSepolia } from '@/wagmi-config';
import { baseSepolia } from 'wagmi/chains';

// Reliable public client for allowance checks on World Chain
const wcPublicClient = createPublicClient({
  chain: worldchainSepolia,
  transport: fallback([
    http('https://worldchain-sepolia.drpc.org'),
    http('https://worldchain-sepolia.gateway.tenderly.co'),
    http('https://4801.rpc.thirdweb.com'),
  ]),
});

const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback([
    http('https://sepolia.base.org'),
    http('https://base-sepolia.drpc.org'),
    http('https://base-sepolia.gateway.tenderly.co'),
  ]),
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'intent' | 'status' | 'receipt';
  data?: any;
}

function usdcToRaw(amount: number): string {
  return BigInt(Math.round(amount * 1e6)).toString();
}

const CHAIN_ID_MAP: Record<string, number> = {
  'World Chain': 4801,
  'Base': 84532,
};

const CHAIN_NAME_MAP: Record<string, 'WORLD_CHAIN' | 'BASE_SEPOLIA'> = {
  'World Chain': 'WORLD_CHAIN',
  'Base': 'BASE_SEPOLIA',
};

export function ChatInterface() {
  const { isMiniKit, walletAddress } = useAuth();
  const { chainId: currentChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load messages from localStorage on mount/wallet change
  useEffect(() => {
    if (!walletAddress) {
      setMessages([{
        role: 'assistant',
        content: 'I am your ChainBridge AI. How can I help you bridge assets today?',
        type: 'text'
      }]);
      return;
    }

    const saved = localStorage.getItem(`blip-chat-${walletAddress}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved messages", e);
      }
    } else {
      setMessages([{
        role: 'assistant',
        content: 'I am your ChainBridge AI. How can I help you bridge assets today?',
        type: 'text'
      }]);
    }
  }, [walletAddress]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (walletAddress && messages.length > 0) {
      localStorage.setItem(`blip-chat-${walletAddress}`, JSON.stringify(messages));
    }
  }, [messages, walletAddress]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [executingIntent, setExecutingIntent] = useState<string | null>(null);
  // Track active intent for WebSocket relay status updates
  const [pendingIntentId, setPendingIntentId] = useState<string | null>(null);
  const [pendingBurnTxHash, setPendingBurnTxHash] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { intents, addIntent } = useIntents(walletAddress || undefined);
  const { isWorldIdVerified, worldIdProof } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // ── WebSocket listener: relay status updates ──────────────────────────────
  useEffect(() => {
    if (!pendingIntentId) return;
    const socket = getSocket();
    if (!socket) return;

    const onRelaying = (data: { intentId: string }) => {
      if (data.intentId !== pendingIntentId) return;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔄 CCTP attestation received — relaying to Base Sepolia…',
        type: 'status',
      }]);
    };

    const onCompleted = (data: { intentId: string; baseTxHash: string | null }) => {
      if (data.intentId !== pendingIntentId) return;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Bridge complete! Your USDC has arrived on Base.',
        type: 'receipt',
        data: {
          status: 'COMPLETED',
          burnTxHash: pendingBurnTxHash,
          destTxHash: data.baseTxHash,
        },
      }]);
      setPendingIntentId(null);
      setPendingBurnTxHash(null);
    };

    const onFailed = (data: { intentId: string; error: string }) => {
      if (data.intentId !== pendingIntentId) return;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Bridge relay failed: ${data.error || 'Unknown error'}`,
        type: 'receipt',
        data: {
          status: 'FAILED',
          burnTxHash: pendingBurnTxHash,
          destTxHash: null,
        },
      }]);
      setPendingIntentId(null);
      setPendingBurnTxHash(null);
    };

    socket.on('intent-relaying', onRelaying);
    socket.on('intent-completed', onCompleted);
    socket.on('intent-failed', onFailed);

    return () => {
      socket.off('intent-relaying', onRelaying);
      socket.off('intent-completed', onCompleted);
      socket.off('intent-failed', onFailed);
    };
  }, [pendingIntentId, pendingBurnTxHash]);

  // ── HTTP polling fallback (in case WebSocket event is missed) ─────────────
  useEffect(() => {
    if (!pendingIntentId) return;

    let active = true;
    const burnHash = pendingBurnTxHash;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/bridge/status/${pendingIntentId}`);
        const data = await res.json();
        if (!active) return;

        if (data.success && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
          setMessages(prev => {
            // Avoid duplicate receipt messages if WebSocket already added one
            if (prev.some(m => m.type === 'receipt' && m.data?.burnTxHash === burnHash)) return prev;
            return [...prev, {
              role: 'assistant',
              content: data.status === 'COMPLETED'
                ? '✅ Bridge complete! Your USDC has arrived on Base.'
                : `❌ Bridge relay failed: ${data.error || 'Unknown error'}`,
              type: 'receipt',
              data: {
                status: data.status,
                burnTxHash: burnHash,
                destTxHash: data.destTxHash || null,
              },
            }];
          });
          setPendingIntentId(null);
          setPendingBurnTxHash(null);
          clearInterval(interval);
        }
      } catch (e) {
        console.error('[ChatInterface] Status poll error:', e);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pendingIntentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core bridge executor ──────────────────────────────────────────────────
  const handleExecuteBridge = async (data: any) => {
    const key = `${data.amount}-${data.recipient}`;
    setExecutingIntent(key);

    try {
      if (!isWorldIdVerified || !worldIdProof) {
        throw new Error("World ID verification required.");
      }

      const finalRecipient = data.recipient === 'self' ? walletAddress : data.recipient;
      if (!finalRecipient) throw new Error("Recipient address not found.");

      const sourceChainId = CHAIN_ID_MAP[data.source] || 4801;
      const destChainId = CHAIN_ID_MAP[data.destination] || 84532;
      const sourceChainName = CHAIN_NAME_MAP[data.source] || 'WORLD_CHAIN';
      const destChainName = CHAIN_NAME_MAP[data.destination] || 'BASE_SEPOLIA';

      const sourceConfig = CHAIN_CONFIGS[sourceChainId];
      const destConfig = CHAIN_CONFIGS[destChainId];

      if (!sourceConfig || !destConfig) throw new Error("Unsupported chain selection.");

      const sourceClient = sourceChainId === 4801 ? wcPublicClient : basePublicClient;

      // Ensure we are on the correct Source Chain
      if (!isMiniKit && currentChainId !== sourceChainId) {
        try {
          await switchChainAsync({ chainId: sourceChainId });
          // Note: After switching, the user might need to click again unless we handle auto-resume.
          // For now, we'll inform them.
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Please switch your wallet to ${sourceConfig.name} and click "Confirm & Execute" again.`,
            type: 'text',
          }]);
          return;
        } catch (e) {
          throw new Error(`Failed to switch to ${sourceConfig.name}. Please switch manually.`);
        }
      }

      const rawAmount = usdcToRaw(data.amount);
      const FEE_AMOUNT = BigInt(100000); // 0.1 USDC — required for CCTP V2
      const totalNeeded = BigInt(rawAmount) + FEE_AMOUNT;
      const recipientBytes32 = `0x${finalRecipient.slice(2).padStart(64, '0')}` as `0x${string}`;
      const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      // ─── MiniKit path (World App) ────────────────────────────────────────
      if (isMiniKit) {
        // Check allowance first
        let currentAllowance = BigInt(0);
        try {
          currentAllowance = await sourceClient.readContract({
            address: sourceConfig.usdc as `0x${string}`,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [walletAddress as `0x${string}`, sourceConfig.tokenMessenger as `0x${string}`],
          }) as bigint;
        } catch (e) { /* ignore — approve anyway if check fails */ }

        const needsApproval = currentAllowance < totalNeeded;

        if (needsApproval) {
          const approveRes = await MiniKit.commandsAsync.sendTransaction({
            transaction: [
              {
                address: sourceConfig.usdc as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [sourceConfig.tokenMessenger as `0x${string}`, rawAmount],
              },
            ],
          });
          if (approveRes.finalPayload.status === 'error') throw new Error('Approval cancelled');

          // Wait for approval to be mined
          const approveHash = approveRes.finalPayload.transaction_id;
          if (approveHash) {
            await sourceClient.waitForTransactionReceipt({ 
              hash: approveHash as `0x${string}`,
              timeout: 300_000 
            });
          }
        }

        // depositForBurn with correct CCTP V2 params
        const burnRes = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: sourceConfig.tokenMessenger as `0x${string}`,
              abi: TOKEN_MESSENGER_ABI,
              functionName: 'depositForBurn',
              args: [
                rawAmount,
                destConfig.domain,
                recipientBytes32,
                sourceConfig.usdc as `0x${string}`,
                zeroBytes32,         // destinationCaller
                '100000',            // maxFee = 0.1 USDC — REQUIRED for CCTP V2 on World Chain
                1000,                // minFinalityThreshold = Fast finality
              ],
            },
          ],
        });

        if (burnRes.finalPayload.status === 'error') throw new Error('Bridge transaction failed or cancelled');

        const txHash = burnRes.finalPayload.transaction_id;

        // Register with backend for monitoring + on-chain record
        const response = await fetch('/api/bridge/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash,
            user: walletAddress,
            amount: rawAmount,
            recipient: finalRecipient,
            proof: worldIdProof,
            sourceChain: sourceChainName,
            destChain: destChainName,
          }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to register bridge with backend');

        const intentId = result.intentId || result.creResponse?.intentId || `fallback_${Date.now()}`;

        addIntent({
          intentId,
          amount: data.amount,
          recipient: finalRecipient,
          status: 'PENDING',
          burnTxHash: txHash,
          sourceTxHash: txHash,
          sourceChain: sourceChainName,
          destChain: destChainName,
        });

        setPendingIntentId(intentId);
        setPendingBurnTxHash(txHash);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⏳ Bridge submitted! Monitoring relay for ${data.amount} USDC → ${destConfig.name}. This usually takes 5–10 minutes on testnet.`,
          type: 'status',
          data: { txHash },
        }]);

      // ─── Web Wallet path (MetaMask / browser extension) ─────────────────
      } else {
        if (!walletClient) throw new Error("Wallet not connected");

        // Check allowance first via reliable public client
        let currentAllowance = BigInt(0);
        try {
          currentAllowance = await sourceClient.readContract({
            address: sourceConfig.usdc as `0x${string}`,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [walletAddress as `0x${string}`, sourceConfig.tokenMessenger as `0x${string}`],
          }) as bigint;
        } catch (e) { /* approve anyway if check fails */ }

        const needsApproval = currentAllowance < totalNeeded;

        if (needsApproval) {
          const approveHash = await writeContractAsync({
            address: sourceConfig.usdc as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [sourceConfig.tokenMessenger as `0x${string}`, totalNeeded],
          });
          await sourceClient.waitForTransactionReceipt({ 
            hash: approveHash, 
            timeout: 300_000 
          });
        }

        // depositForBurn with correct CCTP V2 params
        const burnHash = await writeContractAsync({
          address: sourceConfig.tokenMessenger as `0x${string}`,
          abi: TOKEN_MESSENGER_ABI,
          functionName: 'depositForBurn',
          args: [
            BigInt(rawAmount),
            destConfig.domain,
            recipientBytes32,
            sourceConfig.usdc as `0x${string}`,
            zeroBytes32,        // destinationCaller
            BigInt(100000),     // maxFee = 0.1 USDC — REQUIRED for CCTP V2 on World Chain
            0,                  // minFinalityThreshold = Standard Transfer
          ],
          gas: BigInt(500000), // Manual gas cap to sidestep RPC estimation errors
        });

        await sourceClient.waitForTransactionReceipt({ 
          hash: burnHash,
          timeout: 300_000 
        });

        const response = await fetch('/api/bridge/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: burnHash,
            user: walletAddress,
            amount: rawAmount,
            recipient: finalRecipient,
            proof: worldIdProof,
            sourceChain: sourceChainName,
            destChain: destChainName,
          }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Backend failed to register bridge intent');

        const intentId = result.intentId || result.creResponse?.intentId || `fallback_${Date.now()}`;

        addIntent({
          intentId,
          amount: data.amount,
          recipient: finalRecipient,
          status: 'PENDING',
          burnTxHash: burnHash,
          sourceTxHash: burnHash,
          sourceChain: sourceChainName,
          destChain: destChainName,
        });

        setPendingIntentId(intentId);
        setPendingBurnTxHash(burnHash);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⏳ Bridge submitted! Monitoring relay for ${data.amount} USDC → ${destConfig.name}. This usually takes 5–10 minutes on testnet.`,
          type: 'status',
          data: { txHash: burnHash },
        }]);
      }
    } catch (err: any) {
      console.error('Bridge Execution Error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Bridge failed: ${err.message}`,
        type: 'text',
      }]);
    } finally {
      setExecutingIntent(null);
    }
  };

  // ── AI message handler ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = { role: 'user', content: input, type: 'text' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const aiResponse = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const aiData = await aiResponse.json();

      if (aiData.action === 'send') {
        const recipientDisplay = aiData.recipient === 'self' ? 'your wallet' : aiData.recipient;
        let gasEstimateDisplay = '~';

        const sourceChainId = CHAIN_ID_MAP[aiData.source] || 4801;
        const sourceConfig = CHAIN_CONFIGS[sourceChainId];
        const sourceClientForGas = sourceChainId === 4801 ? wcPublicClient : basePublicClient;

        if (sourceConfig && walletAddress) {
          try {
            const rawAmount = usdcToRaw(aiData.amount);
            const gasLimit = await sourceClientForGas.estimateContractGas({
              address: sourceConfig.usdc as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [sourceConfig.tokenMessenger as `0x${string}`, BigInt(rawAmount)],
              account: walletAddress as `0x${string}`,
            }).catch(() => BigInt(65000));

            const gasPrice = await sourceClientForGas.getGasPrice();
            const gasCost = gasLimit * gasPrice;
            const ethValue = parseFloat(formatEther(gasCost));

            if (ethValue === 0) {
              gasEstimateDisplay = "Very Low";
            } else if (ethValue < 0.000001) {
              gasEstimateDisplay = "< 0.000001 ETH";
            } else {
              gasEstimateDisplay = `~${ethValue.toFixed(8)} ETH`;
            }
          } catch (e) {
            gasEstimateDisplay = '< 0.001 ETH';
          }
        }

        const confirmMessage: Message = {
          role: 'assistant',
          content: `Confirm bridge: ${aiData.amount} USDC from ${aiData.source} to ${recipientDisplay} on ${aiData.destination}.`,
          type: 'intent',
          data: { ...aiData, estimatedGas: gasEstimateDisplay }
        };
        setMessages(prev => [...prev, confirmMessage]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: aiData.message || "I couldn't quite parse that. Try 'Bridge 10 USDC to Base'.",
          type: 'text'
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'AI is temporarily unavailable. Please try again later.',
        type: 'text'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <motion.button
          layoutId="chat-container"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-600/40 z-50 premium-glow"
        >
          <Sparkles className="text-white fill-white" size={28} />
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            layoutId="chat-container"
            initial={{ opacity: 0, scale: 0.9, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 100 }}
            className="fixed bottom-20 right-0 left-0 sm:bottom-24 sm:right-6 sm:left-auto w-full sm:w-[400px] h-[80vh] sm:h-[600px] max-h-[800px] glass-panel bg-black/90 backdrop-blur-2xl sm:rounded-3xl flex flex-col z-50 overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-glass-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                  <Bot size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Bridge Assistant</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-glass-hover rounded-full transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-indigo-600' : 'bg-glass-hover'
                    }`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} className="text-indigo-400" />}
                    </div>

                    <div className="space-y-3">
                      <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-glass-hover text-zinc-300 rounded-tl-none border border-glass-border'
                      }`}>
                        {msg.content}
                        {/* Source tx link on status messages */}
                        {msg.role === 'assistant' && msg.data?.txHash && (
                          <div className="mt-2 pt-2 border-t border-glass-border flex justify-end">
                            <a
                              href={`${CHAIN_CONFIGS[CHAIN_ID_MAP[msg.data.source] || 4801].explorer}/tx/${msg.data.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            >
                              View Source Tx <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* ── Intent Confirmation Card ── */}
                      {msg.type === 'intent' && (
                        <div className="bg-indigo-600/10 border border-indigo-600/20 p-5 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            <span>Intent Detected</span>
                            <Sparkles size={12} />
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase">Bridging</p>
                            <p className="text-xl font-black text-white">{msg.data.amount} USDC</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase">To</p>
                              <div className="flex items-center gap-1.5">
                                {msg.data.recipient === 'self'
                                  ? <Wallet size={12} className="text-indigo-400" />
                                  : <div className="w-3 h-3 bg-zinc-700 rounded-full" />}
                                <span className="text-xs font-bold text-zinc-300">
                                  {msg.data.recipient === 'self' ? 'My Wallet' : `${msg.data.recipient.slice(0, 6)}...`}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase">Chain</p>
                              <p className="text-xs font-bold text-zinc-300">{msg.data.destination}</p>
                            </div>
                          </div>

                          <div className="space-y-1 pt-2 border-t border-indigo-500/10">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-bold uppercase">Source</span>
                              <span className="font-mono text-indigo-300">{msg.data.source}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-bold uppercase">Destination</span>
                              <span className="font-mono text-indigo-300">{msg.data.destination}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-bold uppercase">CCTP Fee</span>
                              <span className="font-mono text-indigo-300">0.10 USDC</span>
                            </div>
                            {msg.data.estimatedGas && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-500 font-bold uppercase">Est. Gas</span>
                                <span className="font-mono text-indigo-300">{msg.data.estimatedGas}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleExecuteBridge(msg.data)}
                            disabled={executingIntent === `${msg.data.amount}-${msg.data.recipient}`}
                            className="w-full py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {executingIntent === `${msg.data.amount}-${msg.data.recipient}`
                              ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Executing…</span>
                              : 'Confirm & Execute'}
                          </button>
                        </div>
                      )}

                      {/* ── Receipt Card (shown after relay completes/fails) ── */}
                      {msg.type === 'receipt' && (
                        <div className={`border p-5 rounded-2xl space-y-3 ${
                          msg.data?.status === 'COMPLETED'
                            ? 'bg-green-500/10 border-green-500/20'
                            : 'bg-red-500/10 border-red-500/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            {msg.data?.status === 'COMPLETED'
                              ? <CheckCircle size={16} className="text-green-400" />
                              : <AlertCircle size={16} className="text-red-400" />}
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              msg.data?.status === 'COMPLETED' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {msg.data?.status === 'COMPLETED' ? 'Bridge Receipt' : 'Bridge Failed'}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {msg.data?.burnTxHash && (
                              <a
                                href={`${CHAIN_CONFIGS[CHAIN_NAME_MAP[msg.data.sourceChain]?.includes('WORLD') ? 4801 : 84532].explorer}/tx/${msg.data.burnTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <ArrowRightLeft size={12} className="text-zinc-500" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Source Tx</span>
                                </div>
                                <span className="text-[10px] font-mono text-indigo-400 group-hover:text-indigo-300">
                                  {msg.data.burnTxHash.slice(0, 8)}… <ExternalLink size={9} className="inline" />
                                </span>
                              </a>
                            )}

                            {msg.data?.destTxHash ? (
                              <a
                                href={`${CHAIN_CONFIGS[CHAIN_NAME_MAP[msg.data.destChain]?.includes('BASE') ? 84532 : 4801].explorer}/tx/${msg.data.destTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle size={12} className="text-green-500" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Dest Tx ({msg.data.destChain === 'BASE_SEPOLIA' ? 'Base' : 'World'})</span>
                                </div>
                                <span className="text-[10px] font-mono text-green-400 group-hover:text-green-300">
                                  {msg.data.destTxHash.slice(0, 8)}… <ExternalLink size={9} className="inline" />
                                </span>
                              </a>
                            ) : msg.data?.status !== 'FAILED' ? (
                              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl opacity-50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dest Tx (Base)</span>
                                <span className="text-[10px] text-zinc-600">Pending…</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 bg-glass border-t border-glass-border">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask to bridge..."
                  disabled={isProcessing}
                  className="w-full pl-5 pr-12 py-4 bg-glass-hover border border-glass-border rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={isProcessing || !input.trim()}
                  className="absolute right-2 top-2 bottom-2 w-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all hover:bg-indigo-700"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
