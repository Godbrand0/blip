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
  setVerified: (proof: ISuccessResult) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isWorldIdVerified: false,
  worldIdProof: null,
  walletAddress: null,
  isMiniKit: false,
  setVerified: () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [isMiniKit, setIsMiniKit] = useState(false);
  const [isWorldIdVerified, setIsWorldIdVerified] = useState(false);
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Detect MiniKit environment
  useEffect(() => {
    setIsMiniKit(MiniKit.isInstalled());
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
    const resolvedAddress = isMiniKit
      ? MiniKit.user?.walletAddress ?? null
      : address ?? null;

    if (resolvedAddress) {
      setWalletAddress(resolvedAddress);
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
      setWalletAddress(null);
      sessionStorage.removeItem("blip_wallet_address");
    }
  }, [address, isMiniKit]);

  const setVerified = useCallback(
    (proof: ISuccessResult) => {
      setIsWorldIdVerified(true);
      setWorldIdProof(proof);
      sessionStorage.setItem("blip_world_id_verified", "true");

      if (walletAddress) {
        sessionStorage.setItem(
          `blip_world_id_${walletAddress}`,
          JSON.stringify(proof),
        );
      }
    },
    [walletAddress],
  );

  const clearAuth = useCallback(() => {
    setIsWorldIdVerified(false);
    setWorldIdProof(null);
    sessionStorage.removeItem("blip_world_id_verified");

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
