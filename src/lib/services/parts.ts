import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenancy/membership";
import type { AuthUser } from "@/lib/auth/types";
import { NotFoundError, ConflictError } from "@/lib/errors";
import type {
  CreatePartRequest,
  UpdatePartRequest,
  PartsCheckResponse,
  PartsCheckItem,
} from "@/lib/contracts/inventory";
import type { Part } from "@/generated/prisma/client";

export type ShopPartItem = Part;

/**
 * List parts for a shop.
 * Allowed: PARTS_PERSON, TECHNICIAN, SERVICE_ADVISOR, OWNER.
 */
export async function getShopParts(
  actor: AuthUser,
  shopId: string
): Promise<ShopPartItem[]> {
  requireMembership(actor, shopId, [
    "PARTS_PERSON",
    "TECHNICIAN",
    "SERVICE_ADVISOR",
    "OWNER",
  ]);

  return db.part.findMany({
    where: { shopId },
    orderBy: { name: "asc" },
  });
}

/**
 * Get a single part by ID scoped to shop.
 */
export async function getShopPartById(
  actor: AuthUser,
  shopId: string,
  partId: string
): Promise<Part> {
  requireMembership(actor, shopId, [
    "PARTS_PERSON",
    "TECHNICIAN",
    "SERVICE_ADVISOR",
    "OWNER",
  ]);

  const part = await db.part.findFirst({
    where: { id: partId, shopId },
  });

  if (!part) {
    throw new NotFoundError("Part not found");
  }

  return part;
}

/**
 * Create a new inventory part.
 * Allowed: PARTS_PERSON, OWNER.
 * SKU must be unique within shop; quantity, reorderLevel, cost must be non-negative.
 */
export async function createPart(
  actor: AuthUser,
  shopId: string,
  data: CreatePartRequest
): Promise<Part> {
  requireMembership(actor, shopId, ["PARTS_PERSON", "OWNER"]);

  const existing = await db.part.findUnique({
    where: {
      shopId_sku: {
        shopId,
        sku: data.sku,
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      `Part with SKU '${data.sku}' already exists in this shop`
    );
  }

  if (data.quantity < 0) {
    throw new ConflictError("Part quantity cannot be negative");
  }

  return db.part.create({
    data: {
      shopId,
      sku: data.sku,
      name: data.name,
      quantity: data.quantity,
      reorderLevel: data.reorderLevel,
      cost: data.cost,
    },
  });
}

/**
 * Update an existing inventory part.
 * Allowed: PARTS_PERSON, OWNER.
 * Stock must never become negative.
 */
export async function updatePart(
  actor: AuthUser,
  shopId: string,
  partId: string,
  data: UpdatePartRequest
): Promise<Part> {
  requireMembership(actor, shopId, ["PARTS_PERSON", "OWNER"]);

  const part = await db.part.findFirst({
    where: { id: partId, shopId },
  });

  if (!part) {
    throw new NotFoundError("Part not found");
  }

  if (data.sku && data.sku !== part.sku) {
    const existing = await db.part.findUnique({
      where: {
        shopId_sku: {
          shopId,
          sku: data.sku,
        },
      },
    });

    if (existing) {
      throw new ConflictError(
        `Part with SKU '${data.sku}' already exists in this shop`
      );
    }
  }

  if (data.quantity !== undefined && data.quantity < 0) {
    throw new ConflictError("Part quantity cannot be negative");
  }

  return db.part.update({
    where: { id: partId },
    data: {
      ...(data.sku !== undefined ? { sku: data.sku } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.reorderLevel !== undefined
        ? { reorderLevel: data.reorderLevel }
        : {}),
      ...(data.cost !== undefined ? { cost: data.cost } : {}),
    },
  });
}

/**
 * Check estimate requirements against inventory for a booking.
 * Compare required quantities with available stock for estimate lines that have a partId.
 * Estimate lines without a partId are custom and not stock-tracked (D-013).
 * Allowed: PARTS_PERSON, SERVICE_ADVISOR, OWNER.
 */
export async function checkBookingParts(
  actor: AuthUser,
  shopId: string,
  bookingId: string
): Promise<PartsCheckResponse> {
  requireMembership(actor, shopId, [
    "PARTS_PERSON",
    "SERVICE_ADVISOR",
    "OWNER",
  ]);

  const booking = await db.booking.findFirst({
    where: { id: bookingId, shopId },
    include: {
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  // Aggregate required quantities by partId for lines of type PART with partId
  const requiredByPart = new Map<string, number>();
  for (const item of booking.estimate?.items || []) {
    if (item.type === "PART" && item.partId) {
      const current = requiredByPart.get(item.partId) || 0;
      requiredByPart.set(item.partId, current + item.quantity);
    }
  }

  const partIds = Array.from(requiredByPart.keys());
  const parts =
    partIds.length > 0
      ? await db.part.findMany({
          where: { id: { in: partIds }, shopId },
        })
      : [];

  const partMap = new Map(parts.map((p) => [p.id, p]));
  const items: PartsCheckItem[] = [];
  let hasShortage = false;

  for (const [partId, requiredQty] of requiredByPart.entries()) {
    const part = partMap.get(partId);
    const availableQty = part ? part.quantity : 0;
    const shortage = Math.max(0, requiredQty - availableQty);
    if (shortage > 0) {
      hasShortage = true;
    }

    items.push({
      partId,
      name: part ? part.name : "Unknown Part",
      sku: part ? part.sku : "UNKNOWN",
      requiredQty,
      availableQty,
      shortage,
    });
  }

  return {
    bookingId: booking.id,
    hasShortage,
    items,
  };
}
