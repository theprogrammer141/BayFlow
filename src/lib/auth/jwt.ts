import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  isCustomer: boolean;
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || env.JWT_SECRET || "fallback-secret-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

export async function signJwt(payload: { userId: string; email: string; isCustomer: boolean }): Promise<string> {
  const secret = getJwtSecretKey();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
