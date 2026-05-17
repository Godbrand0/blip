import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
    }

    const targetUrl = `${backendUrl}/api/bridge/stats`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Cache for 5 seconds to reduce load while keeping it highly dynamic
      next: { revalidate: 5 }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch stats", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Stats Proxy Error:", error.message);
    return NextResponse.json(
      { success: false, error: "Stats request failed", details: error.message },
      { status: 500 }
    );
  }
}
