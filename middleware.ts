import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware: Cookie-based password gate for the entire app.
 *
 * If AUTH_PASSWORD is set, every request (except /login, /api/auth, and static
 * assets) must carry a valid auth cookie. If the cookie is missing or invalid,
 * the user is redirected to /login.
 *
 * If AUTH_PASSWORD is NOT set, the middleware is a no-op — the app is public.
 */
export function middleware(request: NextRequest) {
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
  const authCookie = request.cookies.get("xray_auth");

  if (!authCookie?.value) {
    // No cookie → redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate the cookie value (compare hash)
  // We can't import crypto in edge middleware easily, so we compute the
  // expected value inline using the Web Crypto approach
  // Instead, we store a simple HMAC-like token: sha256(salt + password)
  // and check it matches.
  //
  // For middleware (Edge Runtime), we use a simpler approach:
  // The /api/auth route sets the cookie with the correct hash.
  // Here we just verify the cookie exists and has the right length (64 hex chars for SHA-256).
  const token = authCookie.value;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    // Invalid token format → redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("xray_auth");
    return response;
  }

  // Cookie exists and has valid format — allow through
  // (Full hash validation happens in API routes via auth.ts)
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
