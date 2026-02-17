"use client";

import { useState, useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

export function useMiniKit() {
  const [isMiniKit, setIsMiniKit] = useState(false);

  useEffect(() => {
    setIsMiniKit(MiniKit.isInstalled());
  }, []);

  return {
    isMiniKit,
    user: MiniKit.user,
    walletAddress: MiniKit.user?.walletAddress ?? null,
  };
}
