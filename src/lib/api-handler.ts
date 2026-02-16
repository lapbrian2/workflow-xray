/**
 * Centralized API route handler wrapper.
 * INFR-03: Consistent error handling across all routes.
 * INFR-04: Automatic Zod input validation.
 *
 * Usage:
 *   export const POST = withApiHandler(
 *     async (request, body) => {
 *       // body is validated and typed
 *       return NextResponse.json(result);
 *     },
 *     { schema: MyZodSchema }
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "./api-errors";

interface HandlerOptions<T> {
  /** Zod schema for body validation (POST/PUT/PATCH) */
  schema?: z.ZodType<T>;
  /** "none" for GET/DELETE or FormData routes; default "json" */
  bodyType?: "json" | "none";
}

export function withApiHandler<T = unknown>(
  handler: (request: NextRequest, body: T) => Promise<NextResponse>,
  options: HandlerOptions<T> = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const bodyType = options.bodyType ?? "json";
      let body: T = undefined as T;

      // Parse & validate body for write methods
      if (
        bodyType === "json" &&
        ["POST", "PUT", "PATCH"].includes(request.method)
      ) {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          throw new AppError(
            "INVALID_JSON",
            "Request body must be valid JSON.",
            400
          );
        }

        if (options.schema) {
          const result = options.schema.safeParse(rawBody);
          if (!result.success) {
            throw new AppError(
              "VALIDATION_ERROR",
              "Input validation failed.",
              400,
              result.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              }))
            );
          }
          body = result.data;
        } else {
          body = rawBody as T;
        }
      }

      return await handler(request, body);
    } catch (error) {
      // Known application errors
      if (error instanceof AppError) {
        return errorResponse(
          error.code,
          error.message,
          error.statusCode,
          error.details
        );
      }

      // Zod errors thrown inside the handler
      if (error instanceof z.ZodError) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Data validation failed.",
          400,
          error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          }))
        );
      }

      // Unknown errors — NEVER leak err.message to client
      console.error("[API Error]", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "An unexpected error occurred. Please try again.",
        500
      );
    }
  };
}
