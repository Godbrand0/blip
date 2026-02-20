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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const app_id = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const action = process.env.NEXT_PUBLIC_WORLD_ACTION_ID;

  // Handle both MiniKit (wrapped in payload/action) and IDKit (raw proof)
  const proof = body.payload ? body.payload : body;

  console.log("=== API /verify hit ===");
  console.log("Proof received:", proof);

  const reqBody: Record<string, string> = {
    nullifier_hash: proof.nullifier_hash,
    merkle_root: proof.merkle_root,
    proof: proof.proof,
    verification_level: proof.verification_level,
    action: action!,
  };
  
  if (proof.signal_hash) {
    reqBody.signal_hash = proof.signal_hash;
  }

  try {
    const verifyRes = await fetch(`https://developer.worldcoin.org/api/v2/verify/${app_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    const wldResponse = await verifyRes.json();
    console.log("World ID Response Status:", verifyRes.status);
    console.log("World ID Response Body:", wldResponse);

    if (verifyRes.ok) {
      return NextResponse.json({ success: true, ...wldResponse });
    } else {
      // Handle returning users who have already verified
      if (wldResponse.code === 'max_verifications_reached') {
        console.log("User already verified - treating as success");
        return NextResponse.json({ 
          success: true, 
          already_verified: true,
          ...wldResponse 
        });
      }
      return NextResponse.json({ success: false, ...wldResponse }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Fetch error to World ID API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
