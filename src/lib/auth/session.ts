import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyJwt } from "./jwt";
import { AUTH_COOKIE_NAME, type AuthUser } from "./types";
import { getAuthTokenFromRequest } from "./cookies";

export * from "./types";

export async function getSessionUser(req?: NextRequest): Promise<AuthUser | null> {
  let token: string | null = null;

  if (req) {
    token = getAuthTokenFromRequest(req);
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
    } catch {
      // In non-request context or when cookies() is not available
      token = null;
    }
  }

  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload || !payload.userId) return null;

  try {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isCustomer: user.isCustomer,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        shopId: m.shopId,
        role: m.role,
        isActive: m.isActive,
        shop: m.shop,
      })),
    };
  } catch (error) {
    console.error("Failed to load session user:", error);
    return null;
  }
}
