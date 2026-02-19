// hooks/useIntents.ts

import { create } from "zustand";
import { useEffect } from "react";
import { getSocket } from "@/lib/websocket";

interface Intent {
  intentId?: string;
  amount: number;
  recipient: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  txHash?: string;
  ccipMessageId?: string;
  baseTxHash?: string;
  ccipExplorerUrl?: string;
  basescanUrl?: string;
  error?: string;
}

interface IntentStore {
  intents: Intent[];
  addIntent: (intent: Intent) => void;
  updateIntent: (intentId: string, updates: Partial<Intent>) => void;
}

export const useIntentStore = create<IntentStore>((set) => ({
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
}));

export function useIntents() {
  const { intents, addIntent, updateIntent } = useIntentStore();

  useEffect(() => {
    const socket = getSocket();

    // Don't set up listeners if socket is null (SSR case)
    if (!socket) return;

    // Listen for intent updates
    socket.on("intent-pending", (data) => {
      updateIntent(data.intentId, {
        status: "PENDING",
        ccipMessageId: data.ccipMessageId,
        ccipExplorerUrl: data.ccipExplorerUrl,
      });
    });

    socket.on("intent-completed", (data) => {
      updateIntent(data.intentId, {
        status: "COMPLETED",
        baseTxHash: data.baseTxHash,
        basescanUrl: data.basescanUrl,
      });
    });

    socket.on("intent-failed", (data) => {
      updateIntent(data.intentId, {
        status: "FAILED",
        error: data.error,
      });
    });

    return () => {
      socket.off("intent-pending");
      socket.off("intent-completed");
      socket.off("intent-failed");
    };
  }, [updateIntent]);

  return { intents, addIntent, updateIntent };
}
