import { NextRequest, NextResponse } from "next/server";
import { hashPassword, getExpectedToken, isAuthEnabled, safeCompare, AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth — Validate password and set auth cookie.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per minute per IP (brute force protection)
  const ip = getClientIp(request);
  const rl = rateLimit(`auth:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { password } = body;
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  // Hash the submitted password and compare with expected
  const submittedHash = hashPassword(password);
  const expectedHash = getExpectedToken();

  if (!expectedHash || !safeCompare(submittedHash, expectedHash)) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  // Password correct → set cookie and return success
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_COOKIE_NAME, submittedHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  return response;
}

/**
 * DELETE /api/auth — Logout (clear auth cookie).
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
