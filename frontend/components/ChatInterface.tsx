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
        content: 'Hello buddy, How can I help you blip your assets today?',
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
        content: 'I am blip: I am your ChainBridge AI. How can I help you bridge assets today?',
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
      {/* Floating Action Button - Brutalist B&W */}
      {!isOpen && (
        <motion.button
          layoutId="chat-container"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-12 right-6 w-14 h-14 bg-white text-black rounded-none flex items-center justify-center z-50 border-2 border-black hover:scale-105 transition-transform"
        >
          <Sparkles size={24} fill="currentColor" />
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            layoutId="chat-container"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 right-0 sm:bottom-12 sm:right-6 w-full sm:w-[420px] h-[100dvh] sm:h-[650px] bg-black border-l-2 sm:border-2 border-white flex flex-col z-[60] selection:bg-white selection:text-black"
          >
            {/* Header */}
            <div className="px-6 py-6 border-b-2 border-white flex items-center justify-between bg-black">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white flex items-center justify-center">
                  <Bot size={16} className="text-black" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em]">Bridge Intel</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-white" />
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Active Connection</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white hover:text-black transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 flex items-center justify-center shrink-0 border ${
                      msg.role === 'user' ? 'bg-white text-black border-white' : 'bg-black text-white border-zinc-800'
                    }`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>

                    <div className="space-y-4">
                      <div className={`p-4 text-[13px] leading-relaxed mono ${
                        msg.role === 'user'
                          ? 'bg-white text-black font-bold'
                          : 'bg-zinc-950 text-white border border-zinc-800'
                      }`}>
                        {msg.content}
                        
                        {msg.role === 'assistant' && msg.data?.txHash && (
                          <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-end">
                            <a
                              href={`${CHAIN_CONFIGS[CHAIN_ID_MAP[msg.data.source] || 4801].explorer}/tx/${msg.data.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-1.5"
                            >
                              Explore Tx <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* ── Intent Confirmation Card (Brutalist) ── */}
                      {msg.type === 'intent' && (
                        <div className="border-2 border-white p-6 space-y-6 bg-black">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Signal Detected</span>
                            <Sparkles size={12} className="text-white" />
                          </div>

                          <div className="grid grid-cols-1 gap-6">
                             <div className="space-y-1">
                               <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Asset</p>
                               <p className="text-2xl font-black mono text-white">{msg.data.amount} USDC</p>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1">
                                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">To Chain</p>
                                 <p className="text-xs font-black uppercase mono">{msg.data.destination}</p>
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Recipient</p>
                                 <span className="text-xs font-black uppercase mono">
                                   {msg.data.recipient === 'self' ? 'AUTHOR' : `${msg.data.recipient.slice(0, 6)}...`}
                                 </span>
                               </div>
                             </div>
                          </div>

                          <div className="space-y-2 pt-4 border-t border-zinc-900">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                              <span className="text-zinc-600">Network Fee</span>
                              <span className="mono">0.10 USDC</span>
                            </div>
                            {msg.data.estimatedGas && (
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                <span className="text-zinc-600">Gas Quote</span>
                                <span className="mono">{msg.data.estimatedGas}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleExecuteBridge(msg.data)}
                            disabled={executingIntent === `${msg.data.amount}-${msg.data.recipient}`}
                            className="w-full py-4 bg-white text-black text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-colors disabled:opacity-30"
                          >
                            {executingIntent === `${msg.data.amount}-${msg.data.recipient}`
                              ? <span className="flex items-center justify-center gap-3"><Loader2 size={14} className="animate-spin" /> Processing</span>
                              : 'Authorize Bridge'}
                          </button>
                        </div>
                      )}

                      {/* ── Receipt Card (Brutalist) ── */}
                      {msg.type === 'receipt' && (
                        <div className={`border p-6 space-y-4 bg-black ${
                          msg.data?.status === 'COMPLETED' ? 'border-white' : 'border-red-900'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 ${msg.data?.status === 'COMPLETED' ? 'bg-white' : 'bg-red-600'}`} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {msg.data?.status === 'COMPLETED' ? 'Receipt Issued' : 'Signal Failed'}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {msg.data?.burnTxHash && (
                              <a
                                href={`${CHAIN_CONFIGS[CHAIN_NAME_MAP[msg.data.sourceChain]?.includes('WORLD') ? 4801 : 84532].explorer}/tx/${msg.data.burnTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 border border-zinc-900 hover:border-white transition-colors"
                              >
                                <span className="text-[9px] font-black uppercase text-zinc-500">Source Pulse</span>
                                <span className="text-[10px] font-mono text-white">
                                  {msg.data.burnTxHash.slice(0, 10)}…
                                </span>
                              </a>
                            )}

                            {msg.data?.destTxHash ? (
                              <a
                                href={`${CHAIN_CONFIGS[CHAIN_NAME_MAP[msg.data.destChain]?.includes('BASE') ? 84532 : 4801].explorer}/tx/${msg.data.destTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 border border-zinc-900 hover:border-white transition-colors"
                              >
                                <span className="text-[9px] font-black uppercase text-zinc-500">Target Pulse</span>
                                <span className="text-[10px] font-mono text-white">
                                  {msg.data.destTxHash.slice(0, 10)}…
                                </span>
                              </a>
                            ) : msg.data?.status !== 'FAILED' ? (
                              <div className="flex items-center justify-between p-3 border border-zinc-900 border-dashed opacity-50">
                                <span className="text-[9px] font-black uppercase text-zinc-500">Target Pulse</span>
                                <span className="text-[10px] font-black animate-pulse">PENDING</span>
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
            <div className="p-6 border-t-2 border-white bg-black">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="IDENTIFY BRIDGE INTENT..."
                  disabled={isProcessing}
                  className="w-full pl-5 pr-14 py-5 bg-zinc-950 border border-zinc-800 focus:border-white focus:outline-none text-xs font-black uppercase tracking-widest transition-all mono placeholder:text-zinc-700"
                />
                <button
                  onClick={handleSend}
                  disabled={isProcessing || !input.trim()}
                  className="absolute right-0 top-0 bottom-0 w-14 bg-white text-black flex items-center justify-center disabled:opacity-0 transition-opacity"
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

