import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./AppError";

export function toResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.statusCode }
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", code: "VALIDATION_ERROR", issues: err.issues },
      { status: 422 }
    );
  }

  console.error("[UnhandledError]", err);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
