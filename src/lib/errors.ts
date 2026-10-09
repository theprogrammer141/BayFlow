import type { ApiErrorResponse } from "@/lib/contracts/common";

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHENTICATED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Action forbidden") {
    super(message, "FORBIDDEN_ACTION", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT", details?: unknown) {
    super(message, code, 409, details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message = "Invalid status transition", details?: unknown) {
    super(message, "INVALID_TRANSITION", 409, details);
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, "INTERNAL_ERROR", 500);
  }
}
