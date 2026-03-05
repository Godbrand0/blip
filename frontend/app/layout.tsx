import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { Providers } from "./providers";
import { NavBar } from "@/src/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blip - Cross-Chain Intents",
  description: "Seamlessly bridge assets across chains with Blip's decentralized intent execution platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("MiniKit App ID:", process.env.NEXT_PUBLIC_WORLD_APP_ID);
  return (
    <html lang="en">
      <MiniKitProvider props={{ appId: process.env.NEXT_PUBLIC_WORLD_APP_ID! }}>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen pb-20`}
        >
          <Providers>
            {children}
            <NavBar />
          </Providers>
        </body>
      </MiniKitProvider>
    </html>
  );
}
