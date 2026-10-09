import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signJwt } from "@/lib/auth/jwt";
import { ConflictError, UnauthenticatedError } from "@/lib/errors";
import type { OwnerSignupRequest, LoginRequest } from "@/lib/contracts/auth";
import type { AuthUser } from "@/lib/auth/types";

export async function ownerSignup(data: OwnerSignupRequest): Promise<{ user: AuthUser; token: string }> {
  const existing = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(data.password);

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        isCustomer: false,
        isActive: true,
      },
    });

    const shop = await tx.shop.create({
      data: {
        ownerId: user.id,
        name: data.shopName,
        address: data.address,
        city: data.city,
        phone: data.shopPhone,
        workStart: data.workStart,
        workEnd: data.workEnd,
        slotMinutes: data.slotMinutes,
        slotCapacity: data.slotCapacity,
        logoUrl: data.logoUrl,
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        role: "OWNER",
        isActive: true,
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return { user, shop, membership };
  });

  const authUser: AuthUser = {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    phone: result.user.phone,
    isCustomer: result.user.isCustomer,
    memberships: [
      {
        id: result.membership.id,
        shopId: result.membership.shopId,
        role: result.membership.role,
        isActive: result.membership.isActive,
        shop: result.membership.shop,
      },
    ],
  };

  const token = await signJwt({
    userId: authUser.id,
    email: authUser.email,
    isCustomer: authUser.isCustomer,
  });

  return { user: authUser, token };
}

export async function login(data: LoginRequest): Promise<{ user: AuthUser; token: string }> {
  const user = await db.user.findUnique({
    where: { email: data.email },
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
      ownedShops: {
        select: { id: true },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthenticatedError("Invalid email or password");
  }

  const isValidPassword = await verifyPassword(data.password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthenticatedError("Invalid email or password");
  }

  // Deactivated staff check: staff with no active memberships and no owned shops cannot authenticate
  if (!user.isCustomer && user.memberships.length === 0 && user.ownedShops.length === 0) {
    throw new UnauthenticatedError("Account is deactivated or has no active shop memberships");
  }

  const authUser: AuthUser = {
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

  const token = await signJwt({
    userId: authUser.id,
    email: authUser.email,
    isCustomer: authUser.isCustomer,
  });

  return { user: authUser, token };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await db.user.findUnique({
    where: { id: userId },
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
      ownedShops: {
        select: { id: true },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthenticatedError("User not found or inactive");
  }

  if (!user.isCustomer && user.memberships.length === 0 && user.ownedShops.length === 0) {
    throw new UnauthenticatedError("Account is deactivated or has no active shop memberships");
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
}

export async function findOrCreateCustomer(data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthUser> {
  const existing = await db.user.findUnique({
    where: { email: data.email },
    include: {
      memberships: {
        where: { isActive: true },
      },
    },
  });

  if (existing) {
    const isValid = await verifyPassword(data.password, existing.passwordHash);
    if (!isValid) {
      throw new ConflictError(
        "An account with this email already exists with a different password. Please log in first."
      );
    }

    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      phone: existing.phone,
      isCustomer: existing.isCustomer,
      memberships: existing.memberships.map((m) => ({
        id: m.id,
        shopId: m.shopId,
        role: m.role,
        isActive: m.isActive,
      })),
    };
  }

  const passwordHash = await hashPassword(data.password);
  const created = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      isCustomer: true,
      isActive: true,
    },
  });

  return {
    id: created.id,
    email: created.email,
    name: created.name,
    phone: created.phone,
    isCustomer: created.isCustomer,
    memberships: [],
  };
}
