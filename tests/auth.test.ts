import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signJwt, verifyJwt } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, attachAuthCookie, clearAuthCookie } from "@/lib/auth/cookies";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { ownerSignup, login, getMe, findOrCreateCustomer } from "@/lib/services/auth";
import { db } from "@/lib/db";
import { UnauthenticatedError, ForbiddenError, ConflictError } from "@/lib/errors";
import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth/types";

describe("Auth: Password Hashing", () => {
  it("hashes password and verifies successfully", async () => {
    const raw = "SecurePassword123!";
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(await verifyPassword(raw, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });
});

describe("Auth: JWT Handling", () => {
  it("signs and verifies JWT payload", async () => {
    const payload = {
      userId: "user_test_123",
      email: "test@bayflow.io",
      isCustomer: false,
    };

    const token = await signJwt(payload);
    expect(typeof token).toBe("string");

    const decoded = await verifyJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(payload.userId);
    expect(decoded?.email).toBe(payload.email);
    expect(decoded?.isCustomer).toBe(false);
  });

  it("returns null for invalid or tampered JWT", async () => {
    const invalid = "invalid.token.here";
    expect(await verifyJwt(invalid)).toBeNull();
  });
});

describe("Auth: Cookie Security Flags", () => {
  it("enforces httpOnly, path, and lax sameSite", () => {
    expect(AUTH_COOKIE_NAME).toBe("bayflow_token");
    expect(AUTH_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(AUTH_COOKIE_OPTIONS.path).toBe("/");
    expect(AUTH_COOKIE_OPTIONS.sameSite).toBe("lax");
  });

  it("attaches and clears auth cookie on NextResponse", () => {
    const res = NextResponse.json({ ok: true });
    attachAuthCookie(res, "sample-token");
    expect(res.cookies.get(AUTH_COOKIE_NAME)?.value).toBe("sample-token");

    clearAuthCookie(res);
    expect(res.cookies.get(AUTH_COOKIE_NAME)?.value).toBe("");
  });
});

describe("Auth: Guards", () => {
  const dummyUser: AuthUser = {
    id: "user_1",
    email: "user1@bayflow.io",
    name: "User One",
    phone: null,
    isCustomer: false,
    memberships: [
      {
        id: "mem_1",
        shopId: "shop_1",
        role: "SERVICE_ADVISOR",
        isActive: true,
      },
    ],
  };

  it("requireAuth returns user when authenticated, throws 401 when null", () => {
    expect(requireAuth(dummyUser)).toBe(dummyUser);
    expect(() => requireAuth(null)).toThrow(UnauthenticatedError);
  });

  it("requireRole allows matching role in shop", () => {
    const mem = requireRole(dummyUser, "shop_1", ["SERVICE_ADVISOR", "OWNER"]);
    expect(mem.id).toBe("mem_1");
  });

  it("requireRole rejects unpermitted role with ForbiddenError (403)", () => {
    expect(() => requireRole(dummyUser, "shop_1", ["TECHNICIAN"])).toThrow(ForbiddenError);
  });

  it("requireRole rejects user from non-member shop with ForbiddenError (403)", () => {
    expect(() => requireRole(dummyUser, "shop_2", ["SERVICE_ADVISOR"])).toThrow(ForbiddenError);
  });
});

describe("Auth Service Integration", () => {
  const testEmail = `owner_${Date.now()}@test.io`;

  it("creates owner, shop, and owner membership on signup", async () => {
    const { user, token } = await ownerSignup({
      name: "Tariq Owner",
      email: testEmail,
      password: "password123",
      phone: "+923001234567",
      shopName: "Tariq Motors",
      address: "Main Gulberg",
      city: "Lahore",
      shopPhone: "+924235870000",
      workStart: "09:00",
      workEnd: "18:00",
      slotMinutes: 60,
      slotCapacity: 3,
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(testEmail);
    expect(user.memberships.length).toBe(1);
    expect(user.memberships[0].role).toBe("OWNER");
    expect(typeof token).toBe("string");

    // Verify duplicate email signup fails
    await expect(
      ownerSignup({
        name: "Duplicate",
        email: testEmail,
        password: "password123",
        shopName: "Shop 2",
        address: "Address",
        city: "Karachi",
        shopPhone: "0300",
        workStart: "09:00",
        workEnd: "18:00",
        slotMinutes: 60,
        slotCapacity: 2,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("logs in with valid credentials, rejects invalid password", async () => {
    const loginResult = await login({
      email: testEmail,
      password: "password123",
    });
    expect(loginResult.user.email).toBe(testEmail);
    expect(loginResult.token).toBeDefined();

    // Reject wrong password
    await expect(
      login({
        email: testEmail,
        password: "WrongPassword99",
      })
    ).rejects.toThrow(UnauthenticatedError);

    // Reject nonexistent email
    await expect(
      login({
        email: "nonexistent@test.io",
        password: "password123",
      })
    ).rejects.toThrow(UnauthenticatedError);
  });

  it("retrieves authenticated profile via getMe", async () => {
    const userInDb = await db.user.findUniqueOrThrow({ where: { email: testEmail } });
    const me = await getMe(userInDb.id);
    expect(me.email).toBe(testEmail);
    expect(me.memberships[0].role).toBe("OWNER");
  });

  it("enforces customer account reuse rules", async () => {
    const customerEmail = `customer_${Date.now()}@test.io`;

    // 1. Initial creation
    const customer1 = await findOrCreateCustomer({
      name: "Ahmed Customer",
      email: customerEmail,
      password: "customerpass1",
    });
    expect(customer1.id).toBeDefined();
    expect(customer1.isCustomer).toBe(true);

    // 2. Reuse with matching password
    const customerReuse = await findOrCreateCustomer({
      name: "Ahmed Customer Updated",
      email: customerEmail,
      password: "customerpass1",
    });
    expect(customerReuse.id).toBe(customer1.id);

    // 3. Reject with conflicting password
    await expect(
      findOrCreateCustomer({
        name: "Ahmed Customer",
        email: customerEmail,
        password: "differentpassword",
      })
    ).rejects.toThrow(ConflictError);
  });
});
