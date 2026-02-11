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
import { useAccount } from "wagmi";

interface AuthContextType {
  isWorldIdVerified: boolean;
  worldIdProof: ISuccessResult | null;
  walletAddress: string | null;
  setVerified: (proof: ISuccessResult) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isWorldIdVerified: false,
  worldIdProof: null,
  walletAddress: null,
  setVerified: () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [isWorldIdVerified, setIsWorldIdVerified] = useState(false);
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

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

  useEffect(() => {
    if (address) {
      setWalletAddress(address);
      sessionStorage.setItem("blip_wallet_address", address);
      
      // Check if this wallet was previously verified with World ID
      const storedWorldIdProof = sessionStorage.getItem(`blip_world_id_${address}`);
      if (storedWorldIdProof) {
        try {
          const proof = JSON.parse(storedWorldIdProof);
          setWorldIdProof(proof);
          setIsWorldIdVerified(true);
          sessionStorage.setItem("blip_world_id_verified", "true");
          console.log(`Restored World ID verification for wallet ${address}`);
        } catch (error) {
          console.error("Failed to parse stored World ID proof:", error);
        }
      }
    } else {
      setWalletAddress(null);
      sessionStorage.removeItem("blip_wallet_address");
    }
  }, [address]);

  const setVerified = useCallback((proof: ISuccessResult) => {
    setIsWorldIdVerified(true);
    setWorldIdProof(proof);
    sessionStorage.setItem("blip_world_id_verified", "true");
    
    // Store the association between wallet and World ID
    if (walletAddress) {
      sessionStorage.setItem(`blip_world_id_${walletAddress}`, JSON.stringify(proof));
    }
  }, [walletAddress]);

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
      value={{ isWorldIdVerified, worldIdProof, walletAddress, setVerified, clearAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
