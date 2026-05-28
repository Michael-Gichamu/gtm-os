import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Protect the authenticated app shell.
 *
 * NextAuth v5's `auth` helper isn't edge-safe with the Prisma adapter, so we
 * fall back to verifying the JWT cookie directly here — same secret, no DB
 * round-trip. Pages still re-check the session server-side; this middleware
 * is the cheap pre-filter.
 */
const PROTECTED = ["/dashboard", "/leads", "/activity", "/settings"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
