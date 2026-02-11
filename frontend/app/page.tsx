"use client";

import { useReadContract, useReadContracts } from "wagmi";
import Link from "next/link";
import { AuthGate } from "@/src/components/AuthGate";
import ContentRegistryABI from "@/src/abis/ContentRegistry.json";

const REGISTRY_ADDRESS = ContentRegistryABI.address as `0x${string}`;

export default function HomePage() {
  return (
    <AuthGate>
      <Feed />
    </AuthGate>
  );
}

function Feed() {
  const { data: nextId } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: ContentRegistryABI.abi,
    functionName: "nextContentId",
  });

  const contentCount = nextId ? Number(nextId) : 0;
  const contentCalls = Array.from({ length: contentCount }, (_, i) => ({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: ContentRegistryABI.abi,
    functionName: "contents" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: contentsData, isLoading } = useReadContracts({
    contracts: contentCalls,
  });

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Feed</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Discover registered content on BLIP.
            </p>
          </div>
          <Link
            href="/upload"
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition-all hover:bg-zinc-200"
          >
            + Register
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse"
              >
                <div className="h-4 bg-zinc-800 rounded w-1/4 mb-3" />
                <div className="h-3 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && contentsData && contentsData.length > 0 && (
          <div className="space-y-4">
            {contentsData.map((result, index) => {
              if (result.status !== "success") return null;
              const data = result.result as [string, string, string, boolean, boolean, bigint];
              const [contentHash, , creator, isValidated, isHuman, timestamp] = data;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400">
                      Content #{index}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {new Date(
                        Number(timestamp) * 1000
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 font-mono truncate">
                    CID: {contentHash}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    Creator: {creator}
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
          </div>
        )}

        {!isLoading && contentCount === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
              <svg
                className="h-8 w-8 text-zinc-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <p className="text-zinc-500">
              No content registered yet. Be the first!
            </p>
            <Link
              href="/upload"
              className="inline-block rounded-xl bg-white px-6 py-3 font-bold text-black transition-all hover:bg-zinc-200"
            >
              Register Content
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
