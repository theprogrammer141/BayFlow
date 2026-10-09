import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenancy/membership";
import { hashPassword } from "@/lib/auth/password";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";
import type {
  CreateShopRequest,
  UpdateShopRequest,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  CreateServiceRequest,
  UpdateServiceRequest,
  ShopOverview,
} from "@/lib/contracts/shop";
import { BookingStatusEnum, type BookingStatus } from "@/lib/contracts/common";

export async function requireShopOwner(actor: AuthUser, shopId: string) {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
  });

  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  if (shop.ownerId !== actor.id) {
    throw new ForbiddenError("You do not own this shop");
  }

  return shop;
}

export async function getOwnerShops(actor: AuthUser) {
  return db.shop.findMany({
    where: { ownerId: actor.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createShop(actor: AuthUser, data: CreateShopRequest) {
  return db.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        ownerId: actor.id,
        name: data.name,
        address: data.address,
        city: data.city,
        phone: data.phone,
        logoUrl: data.logoUrl,
        workStart: data.workStart,
        workEnd: data.workEnd,
        slotMinutes: data.slotMinutes,
        slotCapacity: data.slotCapacity,
      },
    });

    // Create OWNER membership for the shop creator so they have full staff membership in this shop
    await tx.membership.create({
      data: {
        userId: actor.id,
        shopId: shop.id,
        role: "OWNER",
        isActive: true,
      },
    });

    return shop;
  });
}

export async function updateShop(
  actor: AuthUser,
  shopId: string,
  data: UpdateShopRequest
) {
  await requireShopOwner(actor, shopId);

  return db.shop.update({
    where: { id: shopId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.workStart !== undefined && { workStart: data.workStart }),
      ...(data.workEnd !== undefined && { workEnd: data.workEnd }),
      ...(data.slotMinutes !== undefined && { slotMinutes: data.slotMinutes }),
      ...(data.slotCapacity !== undefined && { slotCapacity: data.slotCapacity }),
    },
  });
}

export async function getTeamMembers(actor: AuthUser, shopId: string) {
  requireMembership(actor, shopId, ["OWNER", "SERVICE_ADVISOR"]);

  return db.membership.findMany({
    where: { shopId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function addTeamMember(
  actor: AuthUser,
  shopId: string,
  data: AddTeamMemberRequest
) {
  await requireShopOwner(actor, shopId);

  return db.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email: data.email },
    });

    if (user) {
      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_shopId: {
            userId: user.id,
            shopId,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictError("User already has a membership in this shop");
      }
    } else {
      const passwordHash = await hashPassword(data.password);
      user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          passwordHash,
          isCustomer: false,
          isActive: true,
        },
      });
    }

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        shopId,
        role: data.role,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    return membership;
  });
}

export async function updateTeamMember(
  actor: AuthUser,
  shopId: string,
  membershipId: string,
  data: UpdateTeamMemberRequest
) {
  await requireShopOwner(actor, shopId);

  const membership = await db.membership.findFirst({
    where: {
      id: membershipId,
      shopId,
    },
  });

  if (!membership) {
    throw new NotFoundError("Team membership not found in this shop");
  }

  // Prevent shop owner from deactivating their own primary owner membership in their shop
  if (membership.userId === actor.id && data.isActive === false) {
    throw new ForbiddenError("Cannot deactivate the primary shop owner membership");
  }

  return db.membership.update({
    where: { id: membershipId },
    data: {
      ...(data.role !== undefined && { role: data.role }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
    },
  });
}

export async function getShopServices(actor: AuthUser, shopId: string) {
  await requireShopOwner(actor, shopId);

  return db.service.findMany({
    where: { shopId },
    orderBy: { name: "asc" },
  });
}

export async function createShopService(
  actor: AuthUser,
  shopId: string,
  data: CreateServiceRequest
) {
  await requireShopOwner(actor, shopId);

  const existing = await db.service.findUnique({
    where: {
      shopId_name: {
        shopId,
        name: data.name,
      },
    },
  });

  if (existing) {
    throw new ConflictError(`Service '${data.name}' already exists in this shop`);
  }

  return db.service.create({
    data: {
      shopId,
      name: data.name,
      description: data.description,
      estMinutes: data.estMinutes,
      basePrice: data.basePrice,
    },
  });
}

export async function updateShopService(
  actor: AuthUser,
  shopId: string,
  serviceId: string,
  data: UpdateServiceRequest
) {
  await requireShopOwner(actor, shopId);

  const service = await db.service.findFirst({
    where: { id: serviceId, shopId },
  });

  if (!service) {
    throw new NotFoundError("Service not found in this shop");
  }

  if (data.name && data.name !== service.name) {
    const existing = await db.service.findUnique({
      where: {
        shopId_name: {
          shopId,
          name: data.name,
        },
      },
    });

    if (existing && existing.id !== serviceId) {
      throw new ConflictError(`Service '${data.name}' already exists in this shop`);
    }
  }

  return db.service.update({
    where: { id: serviceId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.estMinutes !== undefined && { estMinutes: data.estMinutes }),
      ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
    },
  });
}

export async function getShopOverview(
  actor: AuthUser,
  shopId: string
): Promise<ShopOverview> {
  const shop = await requireShopOwner(actor, shopId);

  // Status counts
  const rawCounts = await db.booking.groupBy({
    by: ["status"],
    where: { shopId },
    _count: {
      status: true,
    },
  });

  const allStatuses = BookingStatusEnum.options;
  const countsByStatus = allStatuses.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<BookingStatus, number>
  );

  for (const item of rawCounts) {
    countsByStatus[item.status as BookingStatus] = item._count.status;
  }

  // Team count
  const teamCount = await db.membership.count({
    where: {
      shopId,
      isActive: true,
    },
  });

  // Inventory summary
  const parts = await db.part.findMany({
    where: { shopId },
    select: {
      quantity: true,
      reorderLevel: true,
    },
  });

  const totalParts = parts.length;
  const lowStockCount = parts.filter(
    (p) => p.quantity <= p.reorderLevel
  ).length;

  return {
    shop,
    countsByStatus,
    teamCount,
    inventorySummary: {
      totalParts,
      lowStockCount,
    },
  };
}
