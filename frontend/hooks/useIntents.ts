// hooks/useIntents.ts

import { create } from "zustand";
import { useEffect } from "react";
import { getSocket } from "@/lib/websocket";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { TRANSACTION_RECORDER_ADDRESS, TRANSACTION_RECORDER_ABI } from "@/src/config/contracts";
import { worldchainSepolia } from "@/wagmi-config";

interface Intent {
  intentId?: string;
  amount: number;
  recipient: string;
  status: "PENDING" | "RELAYING" | "COMPLETED" | "FAILED";
  burnTxHash?: string;
  sourceTxHash?: string;
  messageHash?: string;
  baseTxHash?: string;
  basescanUrl?: string;
  sourceChain?: string;
  destChain?: string;
  error?: string;
  createdAt?: string | Date;
  completedAt?: string | Date | null;
}

import { persist } from "zustand/middleware";

interface IntentStore {
  intents: Intent[];
  addIntent: (intent: Intent) => void;
  updateIntent: (intentId: string, updates: Partial<Intent>) => void;
  setIntents: (intents: Intent[]) => void;
}

export const useIntentStore = create<IntentStore>()(
  persist(
    (set) => ({
      intents: [],

      addIntent: (intent) =>
        set((state) => ({
          intents: [intent, ...state.intents],
        })),

      updateIntent: (intentId, updates) =>
        set((state) => ({
          intents: state.intents.map((intent) =>
            intent.intentId === intentId ? { ...intent, ...updates } : intent,
          ),
        })),

      setIntents: (intents) => set({ intents }),
    }),
    {
      name: "blip-intents-storage",
    }
  )
);

export function useIntents(walletAddress?: string | null) {
  const { intents, addIntent, updateIntent, setIntents } = useIntentStore();

  useEffect(() => {
    if (!walletAddress) return;

    const fetchIntents = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/intents/user/${walletAddress.toLowerCase()}`);
        if (response.ok) {
          const data = await response.json();
          // Normalize: DB stores amount as raw USDC string (e.g. "2000000"), convert to human-readable float
          const normalized = data.map((i: any) => ({
            ...i,
            amount: typeof i.amount === 'string'
              ? parseFloat((Number(i.amount) / 1e6).toFixed(6))
              : Number(i.amount),
          }));
          setIntents(normalized);
        }
      } catch (error) {
        console.error("Failed to fetch intents:", error);
      }
    };

    fetchIntents();
  }, [walletAddress, setIntents]);

  useEffect(() => {
    const socket = getSocket();

    // Don't set up listeners if socket is null (SSR case)
    if (!socket) return;

    // Listen for intent updates
    socket.on("intent-relaying", (data) => {
      updateIntent(data.intentId, {
        status: "RELAYING",
        messageHash: data.messageHash,
      });
    });

    socket.on("intent-completed", (data) => {
      updateIntent(data.intentId, {
        status: "COMPLETED",
        baseTxHash: data.baseTxHash,
      });
    });

    socket.on("intent-failed", (data) => {
      updateIntent(data.intentId, {
        status: "FAILED",
        error: data.error,
      });
    });

    return () => {
      socket.off("intent-relaying");
      socket.off("intent-completed");
      socket.off("intent-failed");
    };
  }, [updateIntent]);

  return { intents, addIntent, updateIntent };
}

// ── On-chain history from BlipHistory.sol ─────────────────────────────────

const STATUS_MAP: Record<number, Intent["status"]> = {
  0: "PENDING",
  1: "RELAYING",
  2: "COMPLETED",
  3: "FAILED",
};

export interface OnChainRecord {
  id: bigint;
  user: string;
  amount: number;
  recipient: string;
  sourceTxHash: string;
  destTxHash: string;
  status: Intent["status"];
  sourceChain?: string;
  destChain?: string;
  createdAt: Date;
  completedAt: Date | null;
}

export function useOnChainHistory(walletAddress?: string | null) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: TRANSACTION_RECORDER_ADDRESS as `0x${string}`,
    abi: TRANSACTION_RECORDER_ABI,
    functionName: "getUserTransactions",
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId: worldchainSepolia.id,
    query: {
      enabled: !!walletAddress && !!TRANSACTION_RECORDER_ADDRESS,
      refetchInterval: 15000,
      staleTime: 10000,
    },
  });

  const { intents } = useIntentStore();

  const records: OnChainRecord[] = data
    ? (data as any[])
        .map((r) => {
          const sourceTxHash = r.sourceTxHash as string;
          const matchingIntent = intents.find(i => 
            i.burnTxHash?.toLowerCase() === sourceTxHash.toLowerCase() ||
            i.sourceTxHash?.toLowerCase() === sourceTxHash.toLowerCase()
          );

          return {
            id:           r.id as bigint,
            user:         r.user as string,
            amount:       parseFloat(formatUnits(r.amount as bigint, 6)),
            recipient:    r.recipient as string,
            sourceTxHash: sourceTxHash,
            destTxHash:   r.destTxHash as string,
            status:       STATUS_MAP[Number(r.status)] ?? "PENDING",
            sourceChain:  matchingIntent?.sourceChain,
            destChain:    matchingIntent?.destChain,
            createdAt:    new Date(Number(r.createdAt) * 1000),
            completedAt:  Number(r.completedAt) > 0 ? new Date(Number(r.completedAt) * 1000) : null,
          };
        })
        .reverse()
    : [];

  return { records, isLoading, error, refetch };
}
