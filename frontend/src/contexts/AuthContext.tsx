"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAccount } from "wagmi";

interface AuthContextType {
  walletAddress: string | null;
  isMiniKit: boolean;
  clearAuth: () => void;
  setWalletAddress: (address: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  walletAddress: null,
  isMiniKit: false,
  clearAuth: () => {},
  setWalletAddress: (_address) => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [isMiniKit, setIsMiniKit] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Detect MiniKit environment robustly
  useEffect(() => {
    try {
      if (MiniKit.isInstalled()) {
        setIsMiniKit(true);
        return;
      }
    } catch {}

    const checkInterval = setInterval(() => {
      try {
        if (MiniKit.isInstalled()) {
          setIsMiniKit(true);
          clearInterval(checkInterval);
        }
      } catch {}
    }, 200);

    const timeout = setTimeout(() => clearInterval(checkInterval), 3000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  // Restore wallet address from session storage
  useEffect(() => {
    const storedWallet = sessionStorage.getItem("blip_wallet_address");
    if (storedWallet) {
      setWalletAddress(storedWallet);
    }
  }, []);

  // Resolve wallet address: MiniKit user or wagmi
  useEffect(() => {
    let resolvedAddress = walletAddress;

    if (isMiniKit) {
      const minikitAddr = (MiniKit as any).user?.walletAddress ?? null;
      if (minikitAddr) resolvedAddress = minikitAddr;
    } else {
      resolvedAddress = address ?? null;
    }

    if (resolvedAddress !== walletAddress) {
      setWalletAddress(resolvedAddress);

      if (resolvedAddress) {
        sessionStorage.setItem("blip_wallet_address", resolvedAddress);
      } else {
        sessionStorage.removeItem("blip_wallet_address");
      }
    }
  }, [address, isMiniKit, walletAddress]);

  const setWalletAddressCallback = useCallback((addr: string) => {
    setWalletAddress(addr);
    sessionStorage.setItem("blip_wallet_address", addr);
  }, []);

  const clearAuth = useCallback(() => {
    setWalletAddress(null);
    sessionStorage.removeItem("blip_wallet_address");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        isMiniKit,
        clearAuth,
        setWalletAddress: setWalletAddressCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
