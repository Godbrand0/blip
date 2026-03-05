"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { ISuccessResult } from "@worldcoin/idkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAccount } from "wagmi";

interface AuthContextType {
  isWorldIdVerified: boolean;
  worldIdProof: ISuccessResult | null;
  walletAddress: string | null;
  isMiniKit: boolean;
  setVerified: (proof: ISuccessResult, walletAddress?: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isWorldIdVerified: false,
  worldIdProof: null,
  walletAddress: null,
  isMiniKit: false,
  setVerified: (_proof, _addr) => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [isMiniKit, setIsMiniKit] = useState(false);
  const [isWorldIdVerified, setIsWorldIdVerified] = useState(false);
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
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

  // Restore verification state from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem("blip_world_id_verified");
    if (stored === "true") {
      setIsWorldIdVerified(true);
    }

    const storedWallet = sessionStorage.getItem("blip_wallet_address");
    if (storedWallet) {
      setWalletAddress(storedWallet);
    }
  }, []);

  // Resolve wallet address: MiniKit user or wagmi
  useEffect(() => {
    // If we are in MiniKit, we don't strictly auto-sync `null` over an existing address
    // because walletAuth sets the address asynchronously.
    let resolvedAddress = walletAddress;
    
    if (isMiniKit) {
      const minikitAddr = (MiniKit as any).walletAddress ?? null;
      if (minikitAddr) resolvedAddress = minikitAddr;
    } else {
      resolvedAddress = address ?? null;
    }

    if (resolvedAddress !== walletAddress) {
      setWalletAddress(resolvedAddress);
      
      if (resolvedAddress) {
        sessionStorage.setItem("blip_wallet_address", resolvedAddress);

        // Check if this wallet was previously verified
        const storedWorldIdProof = sessionStorage.getItem(
          `blip_world_id_${resolvedAddress}`,
        );
        if (storedWorldIdProof) {
          try {
            const proof = JSON.parse(storedWorldIdProof);
            setWorldIdProof(proof);
            setIsWorldIdVerified(true);
            sessionStorage.setItem("blip_world_id_verified", "true");
          } catch (error) {
            console.error("Failed to parse stored World ID proof:", error);
          }
        }
      } else {
        sessionStorage.removeItem("blip_wallet_address");
      }
    }
  }, [address, isMiniKit, walletAddress]);

  const setVerified = useCallback(
    (proof: ISuccessResult, newWalletAddress?: string) => {
      setIsWorldIdVerified(true);
      setWorldIdProof(proof);
      sessionStorage.setItem("blip_world_id_verified", "true");

      let addr = walletAddress;
      if (newWalletAddress) {
        setWalletAddress(newWalletAddress);
        sessionStorage.setItem("blip_wallet_address", newWalletAddress);
        addr = newWalletAddress;
      }

      if (addr) {
        sessionStorage.setItem(
          `blip_world_id_${addr}`,
          JSON.stringify(proof),
        );
      }
    },
    [walletAddress],
  );

  const clearAuth = useCallback(() => {
    setIsWorldIdVerified(false);
    setWorldIdProof(null);
    setWalletAddress(null);
    sessionStorage.removeItem("blip_world_id_verified");
    sessionStorage.removeItem("blip_wallet_address");

    if (walletAddress) {
      sessionStorage.removeItem(`blip_world_id_${walletAddress}`);
    }
  }, [walletAddress]);

  return (
    <AuthContext.Provider
      value={{
        isWorldIdVerified,
        worldIdProof,
        walletAddress,
        isMiniKit,
        setVerified,
        clearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
