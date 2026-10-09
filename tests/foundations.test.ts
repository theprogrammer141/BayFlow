import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NextRequest } from "next/server";
import {
  AppError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InvalidTransitionError,
  InternalError,
} from "@/lib/errors";
import { handle } from "@/lib/api-handler";
import { env } from "@/lib/env";

describe("Foundations: AppError and error mapping", () => {
  it("formats standard AppError response shape", () => {
    const error = new AppError("Something went wrong", "CUSTOM_ERROR", 418, { foo: "bar" });
    expect(error.statusCode).toBe(418);
    expect(error.toResponse()).toEqual({
      error: {
        code: "CUSTOM_ERROR",
        message: "Something went wrong",
        details: { foo: "bar" },
      },
    });
  });

  it("provides correct status codes for each AppError subtype", () => {
    expect(new ValidationError().statusCode).toBe(400);
    expect(new ValidationError().code).toBe("VALIDATION_ERROR");

    expect(new UnauthenticatedError().statusCode).toBe(401);
    expect(new UnauthenticatedError().code).toBe("UNAUTHENTICATED");

    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new ForbiddenError().code).toBe("FORBIDDEN_ACTION");

    expect(new NotFoundError().statusCode).toBe(404);
    expect(new NotFoundError().code).toBe("NOT_FOUND");

    expect(new ConflictError("Item in use").statusCode).toBe(409);
    expect(new ConflictError("Item in use").code).toBe("CONFLICT");

    expect(new InvalidTransitionError().statusCode).toBe(409);
    expect(new InvalidTransitionError().code).toBe("INVALID_TRANSITION");

    expect(new InternalError().statusCode).toBe(500);
    expect(new InternalError().code).toBe("INTERNAL_ERROR");
  });
});

describe("Foundations: Environment Loader", () => {
  it("provides access to required environment variables", () => {
    expect(env.NODE_ENV).toBeDefined();
    expect(env.APP_URL).toBeDefined();
    expect(typeof env.JWT_SECRET).toBe("string");
  });
});

describe("Foundations: handle() Route Wrapper", () => {
  it("wraps successful return values in { data }", async () => {
    const route = handle(async () => {
      return { message: "pong" };
    });

    const req = new NextRequest("http://localhost:3000/api/test");
    const res = await route(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: { message: "pong" } });
  });

  it("validates body with schema and rejects invalid payloads with 400", async () => {
    const route = handle(
      async ({ body }) => {
        return body;
      },
      {
        schema: {
          body: z.object({ count: z.number().positive() }),
        },
      }
    );

    // Invalid body
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ count: -5 }),
    });
    const res = await route(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("catches AppError subclasses and returns the appropriate HTTP status", async () => {
    const route = handle(async () => {
      throw new ForbiddenError("You cannot do that");
    });

    const req = new NextRequest("http://localhost:3000/api/test");
    const res = await route(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "FORBIDDEN_ACTION",
        message: "You cannot do that",
      },
    });
  });

  it("rejects unauthenticated requests when requireAuth is true", async () => {
    const route = handle(
      async ({ user }) => {
        return { user };
      },
      { requireAuth: true }
    );

    const req = new NextRequest("http://localhost:3000/api/test");
    const res = await route(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});
