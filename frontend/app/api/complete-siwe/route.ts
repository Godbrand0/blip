import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  MiniAppWalletAuthSuccessPayload,
  verifySiweMessage,
} from "@worldcoin/minikit-js";

interface IRequestPayload {
  payload: MiniAppWalletAuthSuccessPayload;
  nonce: string;
}

export async function POST(req: NextRequest) {
  const { payload, nonce } = (await req.json()) as IRequestPayload;
  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("siwe-nonce")?.value;

  if (nonce !== storedNonce) {
    console.error("SIWE validation failed: Invalid nonce");
    return NextResponse.json({
      status: "error",
      isValid: false,
      message: "Invalid nonce",
    });
  }

  console.log("Received SIWE payload:", JSON.stringify(payload, null, 2));

  if (!payload || (!payload.message && !(payload as any).siweMessage)) {
    console.error("SIWE validation failed: Missing message in payload");
    return NextResponse.json({
      status: "error",
      isValid: false,
      message: "Missing message in payload",
    });
  }

  // Handle potential nested or renamed message properties depending on minikit-js version or World App response
  const normalizedPayload = {
    ...payload,
    message: payload.message || (payload as any).siweMessage,
  };

  try {
    const validMessage = await verifySiweMessage(normalizedPayload as any, nonce);
    return NextResponse.json({
      status: "success",
      isValid: validMessage.isValid,
    });
  } catch (error: any) {
    // Handle errors in validation or processing
    console.error("SIWE validation error:", error);
    return NextResponse.json({
      status: "error",
      isValid: false,
      message: error?.message || "Internal validation error",
    });
  }
}
