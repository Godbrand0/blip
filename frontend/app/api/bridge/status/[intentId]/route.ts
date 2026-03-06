import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> }
) {
  try {
    const { intentId } = await params;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
    }

    const targetUrl = `${backendUrl}/api/bridge/status/${intentId}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch bridge status", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Bridge Status Proxy Error:", error.message);
    return NextResponse.json(
      { success: false, error: "Bridge status request failed", details: error.message },
      { status: 500 }
    );
  }
}
