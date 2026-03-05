"use client";

import { useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

export function useMiniKit() {
  const [isMiniKit] = useState(MiniKit.isInstalled());

  return {
    isMiniKit,
    user: MiniKit.user,
    walletAddress: MiniKit.user?.walletAddress ?? null,
  };
}
