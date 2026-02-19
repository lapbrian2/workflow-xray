/**
 * Next.js Edge Runtime middleware — enforces auth on all non-public routes.
 *
 * AUTH-01: Unauthenticated API requests get 401 JSON.
 * AUTH-02: Unauthenticated page requests redirect to /login.
 *
 * IMPORTANT: This runs on Edge Runtime — cannot use Node.js `crypto` module.
 * Hash validation uses Web Crypto API (crypto.subtle).
 */

import { NextRequest, NextResponse } from "next/server";

// Inline constant — cannot import from @/lib/auth because it uses Node.js crypto
// which is not available in Edge Runtime.
const AUTH_COOKIE_NAME = "xray_auth";

// ─── Public paths that skip auth ───

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/share/",
  "/share/",
  "/login",
  "/favicon.ico",
  "/_next/",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ─── Constant-time hex string comparison (Edge Runtime safe) ───

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── SHA-256 hash using Web Crypto API ───

async function hashPasswordEdge(password: string): Promise<string> {
  const salt = process.env.AUTH_PASSWORD_SALT || "xray-default-salt-2024";
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Middleware ───

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without auth
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // If AUTH_PASSWORD is not set, auth is disabled — allow all requests
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!cookieValue) {
    return unauthenticatedResponse(request, pathname);
  }

  // Validate cookie value against expected hash
  const expectedHash = await hashPasswordEdge(authPassword);
  if (!constantTimeEqual(cookieValue, expectedHash)) {
    return unauthenticatedResponse(request, pathname);
  }

  return NextResponse.next();
}

// ─── Unauthenticated response helpers ───

function unauthenticatedResponse(
  request: NextRequest,
  pathname: string
): NextResponse {
  // API routes get 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      },
      { status: 401 }
    );
  }

  // Page routes redirect to /login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

// ─── Matcher config ───

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
