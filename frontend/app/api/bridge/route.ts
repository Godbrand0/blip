import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { intentId, user, amount, recipient, destinationChainSelector, proof } =
    body;

  if (!user || !amount || !recipient || !destinationChainSelector || !proof) {
    return NextResponse.json(
      { error: "Missing required bridging fields" },
      { status: 400 },
    );
  }

  const creTriggerUrl = process.env.CRE_TRIGGER_URL;
  const creBearerToken = process.env.CRE_BEARER_TOKEN;

  if (!creTriggerUrl) {
    console.warn("CRE_TRIGGER_URL not set, simulating CRE trigger success");
    return NextResponse.json({
      success: true,
      message: "Simulation: CRE trigger successful",
      details: { intentId, user, amount },
    });
  }

  try {
    const payload = {
      intentId: intentId || `intent_${Date.now()}`,
      user,
      amount,
      recipient,
      destinationChainSelector,
      proof,
    };

    const response = await fetch(creTriggerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creBearerToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to trigger Chainlink CRE", details: data },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, creResponse: data });
  } catch (error: any) {
    console.error("CRE Trigger Error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to trigger Chainlink CRE", details: error.message },
      { status: 500 },
    );
  }
}
