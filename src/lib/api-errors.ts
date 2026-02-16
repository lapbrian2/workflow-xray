/**
 * Structured error handling for API routes.
 * INFR-03: Every error response uses { error: { code, message, details? } }
 *
 * Error Code Catalog:
 * | Code                | HTTP | When                              |
 * |---------------------|------|-----------------------------------|
 * | INVALID_JSON        | 400  | Body is not valid JSON            |
 * | VALIDATION_ERROR    | 400  | Zod/input validation failed       |
 * | UNAUTHORIZED        | 401  | Missing or invalid auth           |
 * | NOT_FOUND           | 404  | Resource not found                |
 * | RATE_LIMITED        | 429  | Rate limit exceeded               |
 * | SERVICE_UNAVAILABLE | 503  | Missing API key or config         |
 * | AI_ERROR            | 502  | Claude/external API failure       |
 * | STORAGE_ERROR       | 500  | KV/Blob operation failed          |
 * | INTERNAL_ERROR      | 500  | Unknown error                     |
 */

import { NextResponse } from "next/server";

// ─── AppError class ───

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ─── Types ───

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── Error response builder ───

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  );
}

// ─── Convenience helpers ───

export const badRequest = (message: string, details?: unknown) =>
  errorResponse("VALIDATION_ERROR", message, 400, details);

export const unauthorized = (message = "Authentication required.") =>
  errorResponse("UNAUTHORIZED", message, 401);

export const notFound = (message = "Resource not found.") =>
  errorResponse("NOT_FOUND", message, 404);

export function rateLimited(retryAfterSeconds: number): NextResponse<ApiErrorResponse> {
  const res = errorResponse(
    "RATE_LIMITED",
    `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
    429
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  res.headers.set("X-RateLimit-Remaining", "0");
  return res;
}

export const serviceUnavailable = (message: string) =>
  errorResponse("SERVICE_UNAVAILABLE", message, 503);

export const internalError = (message = "An unexpected error occurred.") =>
  errorResponse("INTERNAL_ERROR", message, 500);

export const aiError = (message = "AI service error. Please try again.") =>
  errorResponse("AI_ERROR", message, 502);

export const storageError = (message = "Storage operation failed.") =>
  errorResponse("STORAGE_ERROR", message, 500);
