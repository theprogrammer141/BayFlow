import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "./types";
export { AUTH_COOKIE_NAME } from "./types";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export function attachAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export function getAuthTokenFromRequest(req: NextRequest): string | null {
  // Check cookie first
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (cookie?.value) {
    return cookie.value;
  }

  // Fallback to Bearer token in Authorization header for API testing
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}
