import { NextRequest, NextResponse } from "next/server";
import {
  getExpectedToken,
  safeCompare,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";

/**
 * Proxy: Cookie-based password gate for the entire app.
 * INFR-02: Real SHA-256 hash validation (not just format check).
 *
 * Next.js 16 proxy.ts runs on Node.js runtime (NOT Edge), giving us
 * full access to node:crypto via auth.ts for timing-safe comparison.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow: login page, auth API, static files, Next.js internals
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return NextResponse.next();
  }

  // If no AUTH_PASSWORD is set, skip auth entirely
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) {
    return NextResponse.next();
  }

  // Check for the auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  if (!authCookie?.value) {
    // No cookie → redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // REAL validation: compare cookie hash against expected SHA-256 hash
  const expectedToken = getExpectedToken();
  if (!expectedToken || !safeCompare(authCookie.value, expectedToken)) {
    // Invalid or spoofed cookie → redirect to login and clear cookie
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // Cookie valid — allow through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
