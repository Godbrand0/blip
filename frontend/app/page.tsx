"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { useAccount } from "wagmi";
import Link from "next/link";
import { AuthGate } from "@/src/components/AuthGate";
import ContentRegistryABI from "@/src/abis/ContentRegistry.json";
import { type Abi } from "viem";
import { type BlipPost, getLocalPosts } from "./upload/page";

const REGISTRY_ADDRESS = ContentRegistryABI.address as `0x${string}`;
const REGISTRY_ABI = ContentRegistryABI.abi as Abi;

function generateAvatar(address: string): string {
  // Generate a deterministic color from the address
  const hash = address.slice(2, 8);
  return `#${hash}`;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getFileIcon(fileType: string): string {
  if (fileType.startsWith("image/")) return "image";
  if (fileType.startsWith("video/")) return "video";
  if (fileType.startsWith("audio/")) return "audio";
  if (fileType.includes("pdf")) return "document";
  if (fileType.includes("text") || fileType.includes("code")) return "code";
  return "file";
}

export default function HomePage() {
  return (
    <AuthGate>
      <Feed />
    </AuthGate>
  );
}

function Feed() {
  const { address } = useAccount();
  const [localPosts, setLocalPosts] = useState<BlipPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalPosts(getLocalPosts());
    const stored = localStorage.getItem("blip_liked_posts");
    if (stored) setLikedPosts(new Set(JSON.parse(stored)));
  }, []);

  const handleLike = useCallback(
    (postId: string) => {
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        localStorage.setItem("blip_liked_posts", JSON.stringify([...next]));
        return next;
      });

      setLocalPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likes: likedPosts.has(postId) ? p.likes - 1 : p.likes + 1,
              }
            : p,
        ),
      );

      // Persist updated likes
      const posts = getLocalPosts().map((p) =>
        p.id === postId
          ? {
              ...p,
              likes: likedPosts.has(postId) ? p.likes - 1 : p.likes + 1,
            }
          : p,
      );
      localStorage.setItem("blip_posts", JSON.stringify(posts));
    },
    [likedPosts],
  );

  // On-chain content
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

  // Merge on-chain content into display format
  const onChainPosts: BlipPost[] = contentsData
    ? contentsData
        .map((result, index) => {
          if (result.status !== "success") return null;
          const data = result.result as [
            string,
            string,
            string,
            boolean,
            boolean,
            bigint,
          ];
          const [contentHash, , creator, , , timestamp] = data;
          return {
            id: `chain-${index}`,
            cid: contentHash,
            title: `Content #${index}`,
            description: "",
            fileName: "",
            fileType: "",
            creator,
            timestamp: Number(timestamp) * 1000,
            likes: 0,
          } as BlipPost;
        })
        .filter(Boolean) as BlipPost[]
    : [];

  // Combine and deduplicate (local posts that match on-chain CIDs)
  const onChainCids = new Set(onChainPosts.map((p) => p.cid));
  const uniqueLocalPosts = localPosts.filter((p) => !onChainCids.has(p.cid));
  const allPosts = [...uniqueLocalPosts, ...onChainPosts].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

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
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-zinc-800" />
                  <div>
                    <div className="h-3 bg-zinc-800 rounded w-24 mb-2" />
                    <div className="h-2 bg-zinc-800 rounded w-16" />
                  </div>
                </div>
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && allPosts.length > 0 && (
          <div className="space-y-4">
            {allPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={likedPosts.has(post.id)}
                onLike={() => handleLike(post.id)}
                currentUser={address}
              />
            ))}
          </div>
        )}

        {!isLoading && allPosts.length === 0 && (
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

function PostCard({
  post,
  isLiked,
  onLike,
  currentUser,
}: {
  post: BlipPost;
  isLiked: boolean;
  onLike: () => void;
  currentUser?: string;
}) {
  const avatarColor = generateAvatar(post.creator);
  const isOwnPost =
    currentUser?.toLowerCase() === post.creator.toLowerCase();
  const fileIcon = getFileIcon(post.fileType);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      {/* Header: Avatar + Name + Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {post.creator.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {formatAddress(post.creator)}
              </span>
              {isOwnPost && (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                  You
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-500">
              {timeAgo(post.timestamp)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-base font-medium text-white">{post.title}</h3>
        {post.description && (
          <p className="text-sm text-zinc-400">{post.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="bg-zinc-800/60 px-2 py-1 rounded-md capitalize">
            {fileIcon}
          </span>
          <span className="font-mono truncate max-w-[200px]">
            CID: {post.cid.slice(0, 16)}...
          </span>
        </div>
      </div>

      {/* Actions: Like only */}
      <div className="flex items-center pt-2 border-t border-zinc-800/50">
        <button
          onClick={onLike}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
            isLiked
              ? "text-red-400 bg-red-900/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          }`}
        >
          <svg
            className="h-5 w-5"
            fill={isLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span>{post.likes > 0 ? post.likes : "Like"}</span>
        </button>
      </div>
    </div>
  );
}
