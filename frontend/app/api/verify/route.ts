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

  if (!proof) {
    console.error("Empty proof data received");
    return NextResponse.json({ 
      success: false, 
      error: "Empty proof data" 
    }, { status: 400 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  try {
    const targetUrl = backendUrl 
      ? `${backendUrl}/api/verify` 
      // V4 verify fallback (though backendUrl is definitely preferred)
      : `https://developer.world.org/api/v4/verify/${process.env.NEXT_PUBLIC_WORLD_RP_ID}`;

    console.log("Proxying verification to:", targetUrl);

    // Forward the FULL proof payload
    const verifyRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendUrl ? { ...proof, address: body.address } : proof),
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
