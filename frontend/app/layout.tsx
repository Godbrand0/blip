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
  title: "BLIP - Decentralized Content Licensing",
  description: "Secure your IP and start earning royalties globally with BLIP's decentralized content licensing platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <MiniKitProvider>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <Providers>
            <div className="flex h-full flex-col">
              <main className="flex-1 overflow-y-auto pb-20">{children}</main>
              <NavBar />
            </div>
          </Providers>
        </body>
      </MiniKitProvider>
    </html>
  );
}
