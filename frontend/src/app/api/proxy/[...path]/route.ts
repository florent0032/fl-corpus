import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:8011";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(
  request: NextRequest,
  method: string,
  context: RouteContext
) {
  const resolvedParams = await context.params;
  const path = resolvedParams.path.join("/");
  const url = new URL(request.url);
  const backendUrl = `${BACKEND}/api/${path}${url.search}`;

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    let body: string | undefined;

    if (method !== "GET" && method !== "DELETE") {
      body = await request.text();
    }

    const res = await fetch(backendUrl, {
      method,
      headers,
      body,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error(`Proxy error: ${e}`);
    return NextResponse.json(
      { error: String(e) },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  return proxyRequest(request, "GET", context);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  return proxyRequest(request, "POST", context);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  return proxyRequest(request, "PUT", context);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return proxyRequest(request, "DELETE", context);
}
