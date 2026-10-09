import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenancy/membership";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/lib/auth/types";
import type {
  CreatePartRequest,
  CreatePurchaseOrderRequest,
  ReceivePurchaseOrderRequest,
  UpdatePartRequest,
} from "@/lib/contracts/inventory";

const PARTS_READ_ROLES = ["PARTS_PERSON", "OWNER", "SERVICE_ADVISOR"] as const;
const PARTS_WRITE_ROLES = ["PARTS_PERSON"] as const;

function requirePartsRead(actor: AuthUser, shopId: string) {
  return requireMembership(actor, shopId, PARTS_READ_ROLES);
}

function requirePartsWrite(actor: AuthUser, shopId: string) {
  return requireMembership(actor, shopId, PARTS_WRITE_ROLES);
}

async function getTrackedRequirements(
  tx: Prisma.TransactionClient | typeof db,
  bookingId: string,
  shopId: string
) {
  const booking = await tx.booking.findFirst({
    where: { id: bookingId, shopId },
    include: { estimate: { include: { items: true } } },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found in this shop");
  }

  const quantities = new Map<string, number>();
  for (const item of booking.estimate?.items ?? []) {
    if (item.partId) {
      quantities.set(item.partId, (quantities.get(item.partId) ?? 0) + item.quantity);
    }
  }

  return { booking, quantities };
}

export async function listParts(actor: AuthUser, shopId: string) {
  requirePartsRead(actor, shopId);
  return db.part.findMany({ where: { shopId }, orderBy: { name: "asc" } });
}

export async function createPart(actor: AuthUser, shopId: string, data: CreatePartRequest) {
  requirePartsWrite(actor, shopId);
  try {
    return await db.part.create({ data: { ...data, shopId } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictError("A part with this SKU already exists in this shop");
    }
    throw error;
  }
}

export async function updatePart(
  actor: AuthUser,
  shopId: string,
  partId: string,
  data: UpdatePartRequest
) {
  requirePartsWrite(actor, shopId);
  const part = await db.part.findFirst({ where: { id: partId, shopId } });
  if (!part) throw new NotFoundError("Part not found in this shop");

  return db.part.update({ where: { id: partId }, data });
}

export async function getPartsCheck(actor: AuthUser, shopId: string, bookingId: string) {
  requireMembership(actor, shopId, ["PARTS_PERSON", "SERVICE_ADVISOR", "OWNER"]);
  const { quantities } = await getTrackedRequirements(db, bookingId, shopId);
  const parts = await db.part.findMany({ where: { shopId, id: { in: [...quantities.keys()] } } });
  const byId = new Map(parts.map((part) => [part.id, part]));
  const items = [...quantities.entries()].map(([partId, requiredQty]) => {
    const part = byId.get(partId);
    if (!part) throw new NotFoundError("Estimate references a part outside this shop");
    return {
      partId,
      name: part.name,
      sku: part.sku,
      requiredQty,
      availableQty: part.quantity,
      shortage: Math.max(0, requiredQty - part.quantity),
    };
  });

  return { bookingId, hasShortage: items.some((item) => item.shortage > 0), items };
}

export async function listPurchaseOrders(actor: AuthUser, shopId: string) {
  requirePartsWrite(actor, shopId);
  return db.purchaseOrder.findMany({
    where: { shopId },
    include: { items: { include: { part: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPurchaseOrder(
  actor: AuthUser,
  shopId: string,
  data: CreatePurchaseOrderRequest
) {
  requirePartsWrite(actor, shopId);
  return db.$transaction((tx) => createPurchaseOrderInTransaction(tx, actor.id, shopId, data));
}

export async function createPurchaseOrderInTransaction(
  tx: Prisma.TransactionClient,
  createdById: string,
  shopId: string,
  data: CreatePurchaseOrderRequest
) {
  const partIds = [...new Set(data.items.map((item) => item.partId))];
  const parts = await tx.part.findMany({ where: { shopId, id: { in: partIds } } });
  if (parts.length !== partIds.length) throw new NotFoundError("One or more parts are not in this shop");

  const bookingIds = [...new Set(data.items.flatMap((item) => item.bookingId ? [item.bookingId] : []))];
  if (bookingIds.length > 0) {
    const bookings = await tx.booking.findMany({ where: { shopId, id: { in: bookingIds } }, select: { id: true } });
    if (bookings.length !== bookingIds.length) throw new NotFoundError("One or more bookings are not in this shop");
  }

  return tx.purchaseOrder.create({
    data: {
      shopId,
      createdById,
      status: "ORDERED",
      items: { create: data.items },
    },
    include: { items: { include: { part: true } } },
  });
}

export async function receivePurchaseOrder(
  actor: AuthUser,
  shopId: string,
  purchaseOrderId: string,
  data: ReceivePurchaseOrderRequest
) {
  requirePartsWrite(actor, shopId);
  await db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, shopId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("Purchase order not found in this shop");
    if (["RECEIVED", "CANCELLED"].includes(order.status)) throw new ConflictError("Purchase order cannot receive more parts");

    const requested = new Map<string, number>();
    for (const input of data.items) requested.set(input.itemId, (requested.get(input.itemId) ?? 0) + input.qty);
    for (const [itemId, qty] of requested) {
      const item = order.items.find((candidate) => candidate.id === itemId);
      if (!item) throw new NotFoundError("Purchase order item not found");
      const updated = await tx.purchaseOrderItem.updateMany({
        where: { id: item.id, qtyReceived: { lte: item.qtyOrdered - qty } },
        data: { qtyReceived: { increment: qty } },
      });
      if (updated.count !== 1) throw new ConflictError("Received quantity exceeds ordered quantity");
      await tx.part.update({ where: { id: item.partId }, data: { quantity: { increment: qty } } });
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
    const status = updatedItems.every((item) => item.qtyReceived === item.qtyOrdered)
      ? "RECEIVED"
      : "PARTIALLY_RECEIVED";
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });
    const bookingIds = [...new Set(updatedItems.flatMap((item) => item.bookingId ? [item.bookingId] : []))];
    for (const bookingId of bookingIds) {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
      if (booking?.status === "PARTS_ORDERED") {
        const { transitionBookingInTransaction } = await import("@/lib/services/booking-state");
        await transitionBookingInTransaction(tx, { bookingId, to: "PARTS_READY", actor });
      }
    }
    return { bookingIds };
  });

  return db.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: { include: { part: true } } } });
}

export async function getJobsAwaitingParts(actor: AuthUser, shopId: string) {
  requirePartsRead(actor, shopId);
  const bookings = await db.booking.findMany({
    where: { shopId, status: { in: ["PARTS_PENDING", "PARTS_ORDERED", "PARTS_READY"] } },
    include: { estimate: { include: { items: { include: { part: true } } } }, vehicle: true },
    orderBy: { updatedAt: "desc" },
  });
  return bookings.map((booking) => ({
    bookingId: booking.id,
    status: booking.status,
    vehicle: booking.vehicle,
    items: (booking.estimate?.items ?? []).filter((item) => item.partId && item.part).map((item) => ({
      partId: item.partId!,
      name: item.part!.name,
      requiredQty: item.quantity,
      availableQty: item.part!.quantity,
      shortage: Math.max(0, item.quantity - item.part!.quantity),
    })),
  }));
}

export async function assertPartBelongsToShop(tx: Prisma.TransactionClient, partId: string, shopId: string) {
  const part = await tx.part.findFirst({ where: { id: partId, shopId } });
  if (!part) throw new NotFoundError("Part not found in this shop");
  return part;
}

export function assertPartsActor(actor: AuthUser, shopId: string) {
  const membership = actor.memberships.find((item) => item.shopId === shopId && item.isActive);
  if (!membership || membership.role !== "PARTS_PERSON") throw new ForbiddenError("Only Parts Personnel can mutate stock");
}