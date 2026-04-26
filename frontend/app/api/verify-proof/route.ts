import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const { rp_id, idkitResponse, address } = body as {
    rp_id?: string;
    idkitResponse: Record<string, any>;
    address?: string;
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (backendUrl) {
    // Proxy to backend which handles DB/on-chain sync alongside verification
    const response = await fetch(`${backendUrl}/api/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...idkitResponse, address }),
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  }

  // Direct verification (no backend configured)
  // MiniKit verify returns IDKit-v1 format. Route to v1 API unless payload is already v4 format.
  const app_id = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const action = idkitResponse.action || process.env.NEXT_PUBLIC_WORLD_ACTION_ID;

  let apiUrl: string;
  let apiPayload: Record<string, any>;

  if (idkitResponse.responses && Array.isArray(idkitResponse.responses)) {
    // Already v4 format
    apiUrl = `https://developer.world.org/api/v4/verify/${rp_id}`;
    apiPayload = {
      protocol_version: "3.0",
      action,
      signal: idkitResponse.signal || "",
      responses: idkitResponse.responses,
    };
  } else {
    // IDKit v1 format from MiniKit — use v1 API directly
    apiUrl = `https://developer.world.org/api/v1/verify/${app_id}`;
    apiPayload = {
      action,
      signal: idkitResponse.signal || idkitResponse.signal_hash || "",
      proof: idkitResponse.proof,
      nullifier_hash: idkitResponse.nullifier_hash,
      merkle_root: idkitResponse.merkle_root,
      verification_level: idkitResponse.verification_level || "device",
    };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(apiPayload),
  });

  const payload = await response.json();
  return NextResponse.json(
    { success: response.ok, ...payload },
    { status: response.status }
  );
}
