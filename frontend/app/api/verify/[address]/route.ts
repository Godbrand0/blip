import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address) {
    return NextResponse.json({ success: false, error: "Address is required" }, { status: 400 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    // No backend configured — return unverified rather than 404 so AuthGate gracefully redirects
    return NextResponse.json({ success: true, verified: false });
  }

  try {
    const res = await fetch(`${backendUrl}/api/verify/${encodeURIComponent(address)}`, {
      // Don't cache — we always want the live status
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error: any) {
    console.error("[/api/verify/[address]] Proxy error:", error.message);
    // Surface as "not verified" rather than 500 so AuthGate shows the IDKit widget
    return NextResponse.json({ success: true, verified: false });
  }
}
