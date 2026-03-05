"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Link as LinkIcon, ExternalLink, CheckCircle, X, Sparkles, Wallet } from 'lucide-react';
import { useIntents } from '@/hooks/useIntents';
import { MiniKit } from '@worldcoin/minikit-js';
import { useAuth } from '@/src/contexts/AuthContext';
import { usePublicClient, useWriteContract } from 'wagmi';
import { formatEther, parseUnits } from 'viem';
import {
  USDC_ADDRESS,
  TOKEN_MESSENGER_ADDRESS,
  TOKEN_MESSENGER_ABI,
  BASE_SEPOLIA_DOMAIN,
  ERC20_ABI,
} from '@/src/config/contracts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'intent' | 'status';
  data?: any;
}

function usdcToRaw(amount: number): string {
  return BigInt(Math.round(amount * 1e6)).toString();
}

export function ChatInterface() {
  const { isMiniKit, walletAddress } = useAuth();
  const publicClient = usePublicClient();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { intents, addIntent } = useIntents(walletAddress || undefined);
  const { isWorldIdVerified, worldIdProof } = useAuth(); // Destructure proof

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleExecuteBridge = async (data: any) => {
    const key = `${data.amount}-${data.recipient}`;
    setExecutingIntent(key);

    try {
      if (!isWorldIdVerified || !worldIdProof) {
        throw new Error("World ID verification required.");
      }

      // Logic for "self" recipient
      const finalRecipient = data.recipient === 'self' ? walletAddress : data.recipient;
      
      if (!finalRecipient) throw new Error("Recipient address not found.");

      if (isMiniKit) {
        const rawAmount = usdcToRaw(data.amount);
        const recipientBytes32 = `0x${finalRecipient.slice(2).padStart(64, '0')}` as `0x${string}`;
        const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

        const approveRes = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: USDC_ADDRESS as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [TOKEN_MESSENGER_ADDRESS, rawAmount],
            },
          ],
        });

        if (approveRes.finalPayload.status === 'error') throw new Error('Approval cancelled');

        const burnRes = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: TOKEN_MESSENGER_ADDRESS as `0x${string}`,
              abi: TOKEN_MESSENGER_ABI,
              functionName: 'depositForBurn',
              args: [
                BigInt(rawAmount),
                BASE_SEPOLIA_DOMAIN,
                recipientBytes32,
                USDC_ADDRESS as `0x${string}`,
                zeroBytes32,
                BigInt(0),
                0,
              ],
            },
          ],
        });

        if (burnRes.finalPayload.status === 'error') throw new Error('Bridge transaction failed');

        const txHash = burnRes.finalPayload.transaction_id;

        const response = await fetch('/api/bridge/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash,
            user: walletAddress,
            amount: rawAmount,
            recipient: finalRecipient,
            proof: worldIdProof,
          })
        });

        const result = await response.json();
        
        if (result.success) {
          addIntent({
            intentId: result.creResponse?.intentId || Date.now().toString(),
            amount: data.amount,
            recipient: finalRecipient,
            status: 'PENDING',
            burnTxHash: txHash,
          });

          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Bridge triggered! Your ${data.amount} USDC is being bridged to ${finalRecipient === walletAddress ? 'your wallet' : finalRecipient} on Base.`,
            type: 'status',
          }]);
        } else {
          throw new Error(result.error || 'Failed to relay bridge');
        }
      } else {
        // Standard Wagmi Flow
        const rawAmount = usdcToRaw(data.amount);
        const recipientBytes32 = `0x${finalRecipient.slice(2).padStart(64, '0')}` as `0x${string}`;
        const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
        
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TOKEN_MESSENGER_ADDRESS as `0x${string}`, BigInt(rawAmount)],
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        const burnHash = await writeContractAsync({
          address: TOKEN_MESSENGER_ADDRESS as `0x${string}`,
          abi: TOKEN_MESSENGER_ABI,
          functionName: 'depositForBurn',
          args: [
            BigInt(rawAmount),
            BASE_SEPOLIA_DOMAIN,
            recipientBytes32,
            USDC_ADDRESS as `0x${string}`,
            zeroBytes32,
            BigInt(0),
            0,
          ],
          gas: BigInt(500000),
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: burnHash });
        }

        const response = await fetch('/api/bridge/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: burnHash,
            user: walletAddress,
            amount: rawAmount,
            recipient: finalRecipient,
            proof: worldIdProof,
          })
        });

        const result = await response.json();
        
        if (result.success) {
          addIntent({
            intentId: result.creResponse?.intentId || Date.now().toString(),
            amount: data.amount,
            recipient: finalRecipient,
            status: 'PENDING',
            burnTxHash: burnHash,
          });

          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Transaction sent! Once confirmed on World Chain, your ${data.amount} USDC will be bridged to Base.`,
            type: 'status',
            data: { txHash: burnHash }
          }]);
        } else {
          throw new Error(result.error || 'Backend failed to relay bridge intent');
        }
      }
    } catch (err: any) {
      console.error('Execution Error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Bridge failed: ${err.message}`,
        type: 'text',
      }]);
    } finally {
      setExecutingIntent(null);
    }
  };

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

        if (publicClient && walletAddress) {
          try {
            const rawAmount = usdcToRaw(aiData.amount);
            const gasLimit = await publicClient.estimateContractGas({
              address: USDC_ADDRESS as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [TOKEN_MESSENGER_ADDRESS as `0x${string}`, BigInt(rawAmount)],
              account: walletAddress as `0x${string}`,
            }).catch(() => BigInt(65000)); // Fallback if estimation fails (common for 0 balance)

            const gasPrice = await publicClient.getGasPrice();
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
            console.error('Failed to estimate gas', e);
            gasEstimateDisplay = 'Unknown';
          }
        }

        const confirmMessage: Message = {
          role: 'assistant',
          content: `Confirm bridge: ${aiData.amount} USDC to ${recipientDisplay} on Base.`,
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
                        {msg.data?.txHash && (
                          <div className="mt-2 pt-2 border-t border-glass-border flex justify-end">
                            <a 
                              href={`https://worldchain-sepolia.explorer.alchemy.com/tx/${msg.data.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            >
                              View Transaction <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>

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
                                {msg.data.recipient === 'self' ? <Wallet size={12} className="text-indigo-400" /> : <div className="w-3 h-3 bg-zinc-700 rounded-full" />}
                                <span className="text-xs font-bold text-zinc-300">
                                  {msg.data.recipient === 'self' ? 'My Wallet' : `${msg.data.recipient.slice(0, 6)}...`}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase">Chain</p>
                              <p className="text-xs font-bold text-zinc-300">Base</p>
                            </div>
                          </div>

                          {msg.data.estimatedGas && (
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-indigo-500/10">
                              <span className="text-zinc-500 font-bold uppercase">Est. Gas</span>
                              <span className="font-mono text-indigo-300">{msg.data.estimatedGas}</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleExecuteBridge(msg.data)}
                            disabled={executingIntent === `${msg.data.amount}-${msg.data.recipient}`}
                            className="w-full py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50"
                          >
                            {executingIntent ? 'Executing...' : 'Confirm & Execute'}
                          </button>
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
