// components/ChatInterface.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Link as LinkIcon, ExternalLink, CheckCircle } from 'lucide-react';
import { useIntents } from '@/hooks/useIntents';
import { MiniKit } from '@worldcoin/minikit-js';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  USDC_ADDRESS,
  VAULT_ADDRESS,
  BASE_CHAIN_SELECTOR,
  ERC20_ABI,
  VAULT_ABI,
} from '@/src/config/contracts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'intent' | 'status';
  data?: any;
}

// Convert a human-readable USDC amount to 6-decimal raw units
function usdcToRaw(amount: number): string {
  return BigInt(Math.round(amount * 1e6)).toString();
}

export function ChatInterface() {
  const { isMiniKit } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your ChainBridge AI assistant. I can help you send USDC to Base chain. Try saying: "Send 10 USDC to 0x... on Base"',
      type: 'text'
    }
  ]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [executingIntent, setExecutingIntent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { intents, addIntent } = useIntents();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Execute bridge via MiniKit sendTransaction (inside World App)
  const executeBridgeMiniKit = async (amount: number, recipient: string) => {
    if (!MiniKit.isInstalled()) return;

    const rawAmount = usdcToRaw(amount);

    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          // Step 1: Approve USDC to vault
          {
            address: USDC_ADDRESS as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [VAULT_ADDRESS, rawAmount],
          },
          // Step 2: Create bridge intent
          {
            address: VAULT_ADDRESS as `0x${string}`,
            abi: VAULT_ABI,
            functionName: 'createIntent',
            args: [rawAmount, recipient, BASE_CHAIN_SELECTOR],
          },
        ],
      });

      if (finalPayload.status === 'error') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Transaction was cancelled or failed. Please try again.',
          type: 'text',
        }]);
        return;
      }

      // Add intent to tracker
      addIntent({
        intentId: finalPayload.transaction_id,
        amount,
        recipient,
        status: 'PENDING',
        txHash: finalPayload.transaction_id,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Bridge transaction submitted! Tracking your ${amount} USDC transfer to Base.`,
        type: 'status',
      }]);
    } catch (err: any) {
      console.error('MiniKit sendTransaction error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Transaction failed: ${err.message || 'Unknown error'}`,
        type: 'text',
      }]);
    }
  };

  // Handle execute button click
  const handleExecuteBridge = async (data: any) => {
    const key = `${data.amount}-${data.recipient}`;
    setExecutingIntent(key);

    try {
      if (isMiniKit) {
        // Step 1: User Approves USDC to Vault
        const rawAmount = usdcToRaw(data.amount);
        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: USDC_ADDRESS as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [VAULT_ADDRESS, rawAmount],
            },
          ],
        });

        if (finalPayload.status === 'error') {
          throw new Error('Approval cancelled');
        }

        // Step 2: Trigger Backend -> CRE -> Vault.executeBridgeForUser
        const response = await fetch('/api/bridge/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: MiniKit.user?.walletAddress, // Or appropriate user address
            amount: rawAmount,
            recipient: data.recipient,
            destinationChainSelector: BASE_CHAIN_SELECTOR,
            proof: { /* World ID proof from context/auth should go here */ }
          })
        });

        const result = await response.json();
        
        if (result.success) {
          addIntent({
            intentId: result.creResponse?.intentId || Date.now().toString(),
            amount: data.amount,
            recipient: data.recipient,
            status: 'PENDING',
            txHash: result.creResponse?.txHash,
          });

          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Bridge triggered via AI! CRE is executing the transfer. Tx: ${result.creResponse?.txHash}`,
            type: 'status',
          }]);
        } else {
          throw new Error(result.error || 'Failed to trigger bridge');
        }

      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Browser-based bridge execution coming soon. Open in World App for full functionality.',
          type: 'text',
        }]);
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
      // Call AI to parse intent
      const aiResponse = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const aiData = await aiResponse.json();

      if (aiData.action === 'send') {
        const confirmMessage: Message = {
          role: 'assistant',
          content: `I've prepared a transfer of ${aiData.amount} USDC to ${aiData.recipient} on Base. Please approve the transaction.`,
          type: 'intent',
          data: aiData
        };
        setMessages(prev => [...prev, confirmMessage]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: aiData.message || "I couldn't quite understand that. Please specify the amount, recipient address, and destination chain (Base).",
          type: 'text'
        }]);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        type: 'text'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-black flex items-center gap-3">
        <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
          <Bot className="text-white w-5 h-5" />
        </div>
        <div>
          <h2 className="text-white font-bold text-sm">ChainBridge Assistant</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span className="text-[10px] text-zinc-400 font-medium">AI Agent Online</span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className="space-y-2">
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-tr-none'
                      : 'bg-gray-100 text-gray-800 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.type === 'intent' && (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-600 uppercase tracking-wider">
                        <span>Transaction Details</span>
                        <LinkIcon size={14} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-blue-400 font-bold uppercase">Amount</p>
                          <p className="text-sm font-bold text-blue-900">{msg.data.amount} USDC</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-400 font-bold uppercase">Network</p>
                          <p className="text-sm font-bold text-blue-900">Base</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-400 font-bold uppercase">Recipient</p>
                        <p className="text-[11px] font-mono text-blue-900 break-all">{msg.data.recipient}</p>
                      </div>
                      <button
                        onClick={() => handleExecuteBridge(msg.data)}
                        disabled={executingIntent === `${msg.data.amount}-${msg.data.recipient}`}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
                      >
                        {executingIntent === `${msg.data.amount}-${msg.data.recipient}`
                          ? 'Executing...'
                          : 'Execute Bridge Transfer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Active Intents Status */}
        {intents.filter(t => t.status === 'PENDING').map(intent => (
          <motion.div
            key={intent.ccipMessageId || intent.txHash}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center gap-4 border-l-4 border-l-blue-500"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="text-blue-600 w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-gray-900 leading-none">Bridging {intent.amount} USDC...</h4>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">Wait for CCIP finality (~5m)</p>
            </div>
            {intent.ccipExplorerUrl && (
              <a
                href={intent.ccipExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-zinc-200"
              >
                <ExternalLink size={14} className="text-zinc-400" />
              </a>
            )}
          </motion.div>
        ))}

        {intents.filter(t => t.status === 'COMPLETED').slice(0, 1).map(intent => (
          <motion.div
            key={intent.ccipMessageId}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 border border-green-100 p-4 rounded-2xl flex items-center gap-4 border-l-4 border-l-green-500"
          >
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600 w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-gray-900 leading-none">Transfer Successful!</h4>
              <p className="text-[10px] text-green-600 mt-1 font-medium">Assets delivered to Base</p>
            </div>
            {intent.basescanUrl && (
              <a
                href={intent.basescanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-green-200"
              >
                <ExternalLink size={14} className="text-green-400" />
              </a>
            )}
          </motion.div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 bg-gray-50 border-t border-gray-100">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me to bridge USDC..."
            disabled={isProcessing}
            className="w-full pl-5 pr-14 py-4 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm group-hover:border-gray-300"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="absolute right-2 top-2 bottom-2 px-4 bg-black text-white rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-black transition-all flex items-center justify-center shadow-lg active:scale-95"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="mt-3 text-[10px] text-center text-gray-400 font-medium">
          Powered by <span className="text-gray-900">GPT-4</span> & <span className="text-gray-900">Chainlink CCIP</span>
        </p>
      </div>
    </div>
  );
}
