import { NextRequest, NextResponse } from "next/server";
import { hashPassword, getExpectedToken, isAuthEnabled, safeCompare, AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { AuthLoginSchema } from "@/lib/validation";
import type { AuthLoginInput } from "@/lib/validation";

/**
 * POST /api/auth — Validate password and set auth cookie.
 */
export const POST = withApiHandler<AuthLoginInput>(
  async (request, body) => {
    // Rate limit: 5 attempts per minute per IP (brute force protection)
    const ip = getClientIp(request);
    const rl = rateLimit(`auth:${ip}`, 5, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Too many attempts. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    if (!isAuthEnabled()) {
      throw new AppError("SERVICE_UNAVAILABLE", "Authentication is not configured.", 503);
    }

    // Hash the submitted password and compare with expected
    const submittedHash = hashPassword(body.password);
    const expectedHash = getExpectedToken();

    if (!expectedHash || !safeCompare(submittedHash, expectedHash)) {
      throw new AppError("UNAUTHORIZED", "Incorrect password.", 401);
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
  },
  { schema: AuthLoginSchema }
);

/**
 * DELETE /api/auth — Logout (clear auth cookie).
 */
export const DELETE = withApiHandler(
  async () => {
    const response = NextResponse.json({ success: true });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  },
  { bodyType: "none" }
);
