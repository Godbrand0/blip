"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useAuth } from "@/src/contexts/AuthContext";

const navItems = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
        />
      </svg>
    ),
  },
  {
    href: "/bridge",
    label: "Bridge",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export function NavBar() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();
  const { isWorldIdVerified } = useAuth();

  if (!isConnected) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-white bg-black md:top-0 md:bottom-auto md:border-t-0 md:border-b-2">
      <div className="mx-auto flex max-w-7xl items-center justify-around md:justify-end md:gap-16 py-4 px-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex md:flex-row flex-col items-center gap-3 md:px-6 py-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 border-b-2 ${
                isActive ? "text-white border-white" : "text-zinc-600 border-transparent hover:text-white"
              }`}
            >
              <div
                className={`transition-colors ${
                  isActive ? "text-white" : "text-zinc-600"
                }`}
              >
                {item.icon}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
