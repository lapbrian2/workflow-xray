/**
 * Simple in-memory rate limiter for serverless API routes.
 *
 * This is per-instance (not distributed) but still prevents:
 * - A single client from burning Claude credits via rapid-fire requests
 * - Bulk abuse from bots/scripts
 *
 * For distributed rate limiting, swap in Vercel KV or Upstash Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check and consume a rate limit token.
 *
 * @param key - Unique identifier (typically IP or IP+route)
 * @param maxRequests - Maximum requests per window
 * @param windowSeconds - Time window in seconds
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: windowSeconds,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Extract client IP from request headers (works on Vercel).
 *
 * Priority:
 * 1. x-real-ip — set by Vercel's edge, cannot be spoofed
 * 2. x-forwarded-for LAST entry — the rightmost IP is added by the
 *    trusted reverse proxy (Vercel), while clients can prepend fake IPs
 * 3. Fallback to a request-specific fingerprint so "unknown" clients
 *    don't all share one rate-limit bucket
 */
export function getClientIp(request: Request): string {
  // Prefer x-real-ip (Vercel-set, trustworthy)
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  // Fallback: take LAST entry from x-forwarded-for (proxy-appended)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  // Last resort: fingerprint from user-agent + accept-language
  const ua = request.headers.get("user-agent") || "";
  const lang = request.headers.get("accept-language") || "";
  return `anon:${simpleHash(ua + lang)}`;
}

/** Simple string hash for fingerprinting — NOT cryptographic */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
