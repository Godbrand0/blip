import { NextRequest, NextResponse } from "next/server";
import {
  verifyCloudProof,
  IVerifyResponse,
  ISuccessResult,
} from "@worldcoin/minikit-js";

interface IRequestPayload {
  payload: ISuccessResult;
  action: string;
  signal?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ success: false, error: "Address is required" }, { status: 400 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    // Fallback if no backend is configured (unlikely in this setup)
    return NextResponse.json({ success: true, verified: false });
  }

  try {
    const res = await fetch(`${backendUrl}/api/verify/${address}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Verification Status Proxy Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const app_id = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const action = process.env.NEXT_PUBLIC_WORLD_ACTION_ID;

  // Handle both MiniKit (wrapped in payload/action) and IDKit (raw proof)
  let proof = body.payload ? body.payload : body;
  
  // If it's a string (sometimes happens with certain fetch configs), parse it
  if (typeof proof === 'string') {
    try {
      proof = JSON.parse(proof);
    } catch (e) {
      console.error("Failed to parse proof string:", e);
    }
  }

  console.log("=== API /verify hit ===");
  console.log("Proof received:", JSON.stringify(proof, null, 2));

  if (!proof || (!proof.nullifier_hash && !proof.proof)) {
    console.error("Invalid proof object received:", proof);
    return NextResponse.json({ 
      success: false, 
      error: "Invalid or empty proof data" 
    }, { status: 400 });
  }

  const reqBody: Record<string, string> = {
    nullifier_hash: proof.nullifier_hash,
    merkle_root: proof.merkle_root,
    proof: proof.proof,
    verification_level: proof.verification_level || "device",
    action: action!,
  };
  
  if (proof.signal_hash) {
    reqBody.signal_hash = proof.signal_hash;
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  try {
    const targetUrl = backendUrl 
      ? `${backendUrl}/api/verify` 
      : `https://developer.worldcoin.org/api/v2/verify/${app_id}`;

    console.log("Proxying verification to:", targetUrl);

    const verifyRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendUrl ? { ...proof, address: body.address } : reqBody),
    });

    const wldResponse = await verifyRes.json();
    
    if (verifyRes.ok) {
      return NextResponse.json({ success: true, ...wldResponse });
    } else {
      if (wldResponse.code === 'max_verifications_reached' || wldResponse.already_verified) {
        return NextResponse.json({ 
          success: true, 
          already_verified: true,
          ...wldResponse 
        });
      }
      return NextResponse.json({ success: false, ...wldResponse }, { status: verifyRes.status });
    }
  } catch (error: any) {
    console.error("Verification Proxy Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
