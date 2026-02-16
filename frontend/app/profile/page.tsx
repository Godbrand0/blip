"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { formatEther, type Abi } from "viem";
import { AuthGate } from "@/src/components/AuthGate";
import { useAuth } from "@/src/contexts/AuthContext";
import ContentRegistryABI from "@/src/abis/ContentRegistry.json";
import RoyaltyPayoutABI from "@/src/abis/RoyaltyPayout.json";

const REGISTRY_ADDRESS = ContentRegistryABI.address as `0x${string}`;
const REGISTRY_ABI = ContentRegistryABI.abi as Abi;
const ROYALTY_ADDRESS = RoyaltyPayoutABI.address as `0x${string}`;
const ROYALTY_ABI = RoyaltyPayoutABI.abi as Abi;

export default function ProfilePage() {
  return (
    <AuthGate>
      <Profile />
    </AuthGate>
  );
}

function Profile() {
  const { address } = useAccount();
  const { writeContract } = useWriteContract();
  const { isWorldIdVerified, worldIdProof } = useAuth();

  const { data: royaltyBalance } = useReadContract({
    address: ROYALTY_ADDRESS,
    abi: ROYALTY_ABI,
    functionName: "balances",
    args: [address],
  });

  const { data: nextId } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "nextContentId",
  });

  const contentCount = nextId ? Number(nextId) : 0;
  const contentCalls = Array.from({ length: contentCount }, (_, i) => ({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "contents" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: contentsData, isLoading } = useReadContracts({
    contracts: contentCalls,
  });

  const myContent = contentsData
    ?.map((result, index) => ({ result, index }))
    .filter(({ result }) => {
      if (result.status !== "success") return false;
      const data = result.result as [string, string, string, boolean, boolean, bigint];
      return data[2]?.toLowerCase() === address?.toLowerCase();
    });

  const handleClaim = () => {
    writeContract({
      address: ROYALTY_ADDRESS,
      abi: ROYALTY_ABI,
      functionName: "claimRoyalties",
    });
  };

  const balance = royaltyBalance as bigint | undefined;

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-zinc-500 font-mono truncate">{address}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Identity Verification</h2>
          <div className="flex items-center gap-3">
            {isWorldIdVerified ? (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-400">World ID Verified</span>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                  Human Status Confirmed
                </span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-red-400">Not Verified</span>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                  World ID Required
                </span>
              </>
            )}
          </div>
          {worldIdProof && (
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Verification Level: {worldIdProof.verification_level}</p>
              <p>Nullifier Hash: {worldIdProof.nullifier_hash.slice(0, 10)}...{worldIdProof.nullifier_hash.slice(-6)}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Royalty Balance</h2>
          <p className="text-2xl font-bold">
            {balance ? formatEther(balance) : "0"} ETH
          </p>
          <button
            onClick={handleClaim}
            disabled={!balance || balance === BigInt(0)}
            className="rounded-xl bg-white px-6 py-3 font-bold text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
          >
            Claim Royalties
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Your Content ({myContent?.length || 0})
          </h2>

          {isLoading && <p className="text-zinc-500">Loading...</p>}

          {myContent?.map(({ result, index }) => {
            const data = result.result as [string, string, string, boolean, boolean, bigint];
            const [contentHash, , , isValidated, isHuman, timestamp] = data;
            return (
              <div
                key={index}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">#{index}</span>
                  <span className="text-xs text-zinc-600">
                    {new Date(Number(timestamp) * 1000).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 font-mono truncate">
                  CID: {contentHash}
                </p>
                <div className="flex gap-2">
                  {isValidated && (
                    <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">
                      Validated
                    </span>
                  )}
                  {isHuman && (
                    <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">
                      Human
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {!isLoading && (!myContent || myContent.length === 0) && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
              You haven&apos;t registered any content yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
