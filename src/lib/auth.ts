/**
 * Shared auth utilities for cookie-based password authentication.
 *
 * Level 1 security: A single shared password set via AUTH_PASSWORD env var.
 * The password is hashed (SHA-256) before being stored in the cookie so the
 * raw password never travels after the initial POST to /api/auth.
 */

import { createHash } from "crypto";

export const AUTH_COOKIE_NAME = "xray_auth";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Hash the password with a server-side salt for cookie comparison.
 * This means the cookie value is a hash, not the plaintext password.
 */
export function hashPassword(password: string): string {
  const salt = process.env.AUTH_PASSWORD_SALT || "xray-default-salt-2024";
  return createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");
}

/**
 * Generate the expected cookie value from the configured password.
 */
export function getExpectedToken(): string | null {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return null; // Auth disabled if no password set
  return hashPassword(password);
}

/**
 * Check if auth is enabled (AUTH_PASSWORD env var is set).
 */
export function isAuthEnabled(): boolean {
  return !!process.env.AUTH_PASSWORD;
}
