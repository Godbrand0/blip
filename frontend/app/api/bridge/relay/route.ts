import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { txHash, user, amount, recipient, proof } = body;

    if (!txHash || !user || !amount || !recipient) {
      return NextResponse.json(
        { error: "Missing required bridging fields" },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
    }

    const payload = {
      txHash,
      user,
      amount,
      recipient,
      proof,
    };

    const targetUrl = `${backendUrl}/api/bridge/relay`;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to relay bridge", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, creResponse: data });
  } catch (error: any) {
    console.error("Bridge Proxy Error:", error.message);
    return NextResponse.json(
      { success: false, error: "Bridge relay failed", details: error.message },
      { status: 500 }
    );
  }
}
