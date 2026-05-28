import { NextRequest, NextResponse } from "next/server";
import { INTERNAL_JWT_HEADER } from "@gtm/shared";
import { auth } from "@/lib/auth";
import { signInternalJwt } from "@/lib/api/internalJwt";
import { serverEnv } from "@/lib/env";

/**
 * Same-origin proxy that bridges the browser to the Express API.
 *
 *   browser -> /api/proxy/leads?limit=20
 *      -> sign short-lived JWT using the workspace from the NextAuth session
 *      -> forward to {API_BASE_URL}/v1/leads?limit=20
 *      -> stream the response back, status + body intact
 *
 * Keeping the JWT secret server-side is the whole point — never ship it in
 * the client bundle, and never let the browser address Express directly.
 */
async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { path } = await ctx.params;
  const sub = path.join("/");
  const url = new URL(`${serverEnv.API_BASE_URL}/v1/${sub}`);
  for (const [k, v] of req.nextUrl.searchParams.entries()) url.searchParams.set(k, v);

  const token = signInternalJwt({
    sub: session.user.id,
    wsid: session.user.workspaceId,
    role: session.user.workspaceRole,
  });

  const init: RequestInit = {
    method: req.method,
    headers: {
      "content-type": "application/json",
      [INTERNAL_JWT_HEADER]: token,
    },
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(url, init);
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
