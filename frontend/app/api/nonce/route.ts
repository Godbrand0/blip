import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Expects only alphanumeric characters
  const nonce = crypto.randomUUID().replace(/-/g, "");

  // The nonce should be stored somewhere that is not tamperable by the client
  // Awaiting cookies() in Next.js 15+
  const cookieStore = await cookies();
  cookieStore.set("siwe-nonce", nonce, { secure: process.env.NODE_ENV === "production" });

  return NextResponse.json({ nonce });
}
