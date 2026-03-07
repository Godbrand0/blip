import { NextResponse } from "next/server";
import type { IDKitResult } from "@worldcoin/idkit";

export async function POST(request: Request): Promise<Response> {
  const { rp_id, idkitResponse, address } = (await request.json()) as {
    rp_id: string;
    idkitResponse: IDKitResult;
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

  // Direct World ID verification (no backend)
  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${rp_id}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResponse),
    },
  );

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
