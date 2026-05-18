import { NextRequest, NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ path?: string[] }>;
};

async function handleProxy(req: NextRequest, { params }: RouteParams) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    const resolvedParams = await params;
    const pathStr = resolvedParams.path ? resolvedParams.path.join("/") : "";
    
    // Parse query params if present
    const url = new URL(req.url);
    const searchParams = url.searchParams.toString();
    const targetUrl = `${backendUrl}/api/circle/${pathStr}${searchParams ? `?${searchParams}` : ""}`;

    const headers = new Headers();
    const reqHeaders = req.headers;
    
    // Proxy essential headers
    const contentType = reqHeaders.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    
    const userToken = reqHeaders.get("x-user-token");
    if (userToken) headers.set("x-user-token", userToken);

    // Extract request body for writing operations
    let body: any = undefined;
    if (req.method === "POST" || req.method === "PUT") {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error(`[Circle Proxy] Error on ${req.method} request:`, error.message);
    return NextResponse.json(
      { success: false, error: "Circle proxy request failed", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, context: RouteParams) {
  return handleProxy(req, context);
}

export async function POST(req: NextRequest, context: RouteParams) {
  return handleProxy(req, context);
}
