import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenancy/membership";
import type { AuthUser } from "@/lib/auth/types";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/errors";
import type {
  CreatePurchaseOrderRequest,
  ReceivePurchaseOrderRequest,
} from "@/lib/contracts/inventory";
import type { POStatus, PurchaseOrder } from "@/generated/prisma/client";
import { transitionBooking } from "@/lib/services/booking-state";

export interface ShopPurchaseOrderWithDetails extends PurchaseOrder {
  items: Array<{
    id: string;
    purchaseOrderId: string;
    partId: string;
    bookingId: string | null;
    qtyOrdered: number;
    qtyReceived: number;
    part: {
      id: string;
      name: string;
      sku: string;
      cost: number;
      quantity: number;
    };
    booking?: {
      id: string;
      status: string;
      vehicle: {
        regNo: string;
        make: string;
        model: string;
      };
    } | null;
  }>;
}

/**
 * List purchase orders for a shop.
 * Allowed: PARTS_PERSON, SERVICE_ADVISOR, OWNER.
 */
export async function getShopPurchaseOrders(
  actor: AuthUser,
  shopId: string,
  status?: POStatus
): Promise<ShopPurchaseOrderWithDetails[]> {
  requireMembership(actor, shopId, [
    "PARTS_PERSON",
    "SERVICE_ADVISOR",
    "OWNER",
  ]);

  const orders = await db.purchaseOrder.findMany({
    where: {
      shopId,
      ...(status ? { status } : {}),
    },
    include: {
      items: {
        include: {
          part: {
            select: {
              id: true,
              name: true,
              sku: true,
              cost: true,
              quantity: true,
            },
          },
          booking: {
            select: {
              id: true,
              status: true,
              vehicle: {
                select: {
                  regNo: true,
                  make: true,
                  model: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders as unknown as ShopPurchaseOrderWithDetails[];
}

/**
 * Get a single purchase order by ID scoped to shop.
 */
export async function getShopPurchaseOrderById(
  actor: AuthUser,
  shopId: string,
  poId: string
): Promise<ShopPurchaseOrderWithDetails> {
  requireMembership(actor, shopId, [
    "PARTS_PERSON",
    "SERVICE_ADVISOR",
    "OWNER",
  ]);

  const order = await db.purchaseOrder.findFirst({
    where: { id: poId, shopId },
    include: {
      items: {
        include: {
          part: {
            select: {
              id: true,
              name: true,
              sku: true,
              cost: true,
              quantity: true,
            },
          },
          booking: {
            select: {
              id: true,
              status: true,
              vehicle: {
                select: {
                  regNo: true,
                  make: true,
                  model: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Purchase order not found");
  }

  return order as unknown as ShopPurchaseOrderWithDetails;
}

/**
 * Create a new purchase order from shortages or ad-hoc.
 * Allowed: PARTS_PERSON, OWNER.
 */
export async function createPurchaseOrder(
  actor: AuthUser,
  shopId: string,
  data: CreatePurchaseOrderRequest
): Promise<ShopPurchaseOrderWithDetails> {
  requireMembership(actor, shopId, ["PARTS_PERSON", "OWNER"]);

  if (!data.items || data.items.length === 0) {
    throw new ValidationError("Purchase order must contain at least one item");
  }

  // Validate that all parts belong to this shop
  const partIds = data.items.map((i) => i.partId);
  const parts = await db.part.findMany({
    where: { id: { in: partIds }, shopId },
  });

  if (parts.length !== new Set(partIds).size) {
    throw new ValidationError(
      "One or more parts do not exist or do not belong to this shop"
    );
  }

  // If any item links to a booking, validate booking belongs to this shop
  const bookingIds = data.items
    .map((i) => i.bookingId)
    .filter((id): id is string => Boolean(id));

  if (bookingIds.length > 0) {
    const bookings = await db.booking.findMany({
      where: { id: { in: bookingIds }, shopId },
    });
    if (bookings.length !== new Set(bookingIds).size) {
      throw new ValidationError(
        "One or more bookings do not belong to this shop"
      );
    }
  }

  const po = await db.purchaseOrder.create({
    data: {
      shopId,
      createdById: actor.id,
      status: "ORDERED",
      items: {
        create: data.items.map((item) => ({
          partId: item.partId,
          bookingId: item.bookingId ?? null,
          qtyOrdered: item.qtyOrdered,
          qtyReceived: 0,
        })),
      },
    },
    include: {
      items: {
        include: {
          part: {
            select: {
              id: true,
              name: true,
              sku: true,
              cost: true,
              quantity: true,
            },
          },
          booking: {
            select: {
              id: true,
              status: true,
              vehicle: {
                select: {
                  regNo: true,
                  make: true,
                  model: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return po as unknown as ShopPurchaseOrderWithDetails;
}

/**
 * Receive items on a purchase order.
 * Updates stock, item qtyReceived, and PO status (PARTIALLY_RECEIVED or RECEIVED) in a single transaction.
 * If all parts required for linked bookings in PARTS_ORDERED are fully received,
 * transitions those bookings to PARTS_READY via transitionBooking.
 * Allowed: PARTS_PERSON, OWNER.
 */
export async function receivePurchaseOrder(
  actor: AuthUser,
  shopId: string,
  poId: string,
  data: ReceivePurchaseOrderRequest
): Promise<ShopPurchaseOrderWithDetails> {
  requireMembership(actor, shopId, ["PARTS_PERSON", "OWNER"]);

  if (!data.items || data.items.length === 0) {
    throw new ValidationError("Must receive at least one item");
  }

  // Single transaction: update stock, item quantities, and PO status
  const { updatedPO, linkedBookingIds } = await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, shopId },
      include: {
        items: {
          include: { part: true },
        },
      },
    });

    if (!po) {
      throw new NotFoundError("Purchase order not found");
    }

    if (po.status === "RECEIVED") {
      throw new ConflictError("Purchase order has already been fully received");
    }

    if (po.status === "CANCELLED") {
      throw new ConflictError("Cannot receive items on a cancelled purchase order");
    }

    const itemMap = new Map(po.items.map((item) => [item.id, item]));

    for (const recItem of data.items) {
      const item = itemMap.get(recItem.itemId);
      if (!item) {
        throw new ValidationError(
          `Item '${recItem.itemId}' does not exist on this purchase order`
        );
      }

      if (recItem.qty <= 0) {
        throw new ValidationError("Received quantity must be positive");
      }

      const remainingOrdered = item.qtyOrdered - item.qtyReceived;
      if (recItem.qty > remainingOrdered) {
        throw new ValidationError(
          `Received quantity (${recItem.qty}) exceeds remaining ordered quantity (${remainingOrdered}) for ${item.part.name}`
        );
      }

      // 1. Update PO item qtyReceived
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { qtyReceived: { increment: recItem.qty } },
      });

      // 2. Atomically increment part quantity
      await tx.part.update({
        where: { id: item.partId },
        data: { quantity: { increment: recItem.qty } },
      });

      // Update in-memory reference to determine final status
      item.qtyReceived += recItem.qty;
    }

    // 3. Determine new PO status
    const allReceived = po.items.every(
      (item) => item.qtyReceived >= item.qtyOrdered
    );
    const anyReceived = po.items.some((item) => item.qtyReceived > 0);
    const nextStatus: POStatus = allReceived
      ? "RECEIVED"
      : anyReceived
      ? "PARTIALLY_RECEIVED"
      : "ORDERED";

    const savedPO = await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: nextStatus },
      include: {
        items: {
          include: {
            part: {
              select: {
                id: true,
                name: true,
                sku: true,
                cost: true,
                quantity: true,
              },
            },
            booking: {
              select: {
                id: true,
                status: true,
                vehicle: {
                  select: {
                    regNo: true,
                    make: true,
                    model: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const uniqueBookingIds = Array.from(
      new Set(
        po.items
          .map((i) => i.bookingId)
          .filter((id): id is string => Boolean(id))
      )
    );

    return {
      updatedPO: savedPO as unknown as ShopPurchaseOrderWithDetails,
      linkedBookingIds: uniqueBookingIds,
    };
  });

  // Check each linked booking for automatic transition to PARTS_READY
  for (const bookingId of linkedBookingIds) {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        purchaseItems: true,
        estimate: { include: { items: true } },
      },
    });

    if (booking && booking.status === "PARTS_ORDERED") {
      // Check if all PO items for this booking are fully received
      const allPOItemsReceived =
        booking.purchaseItems.length > 0 &&
        booking.purchaseItems.every((item) => item.qtyReceived >= item.qtyOrdered);

      // Check if all required estimate parts have sufficient stock
      const requiredByPart = new Map<string, number>();
      for (const estItem of booking.estimate?.items || []) {
        if (estItem.type === "PART" && estItem.partId) {
          const cur = requiredByPart.get(estItem.partId) || 0;
          requiredByPart.set(estItem.partId, cur + estItem.quantity);
        }
      }

      let allInStock = true;
      for (const [partId, reqQty] of requiredByPart.entries()) {
        const part = await db.part.findUnique({ where: { id: partId } });
        if (!part || part.quantity < reqQty) {
          allInStock = false;
          break;
        }
      }

      if (allPOItemsReceived && allInStock) {
        await transitionBooking({
          bookingId,
          to: "PARTS_READY",
          actor,
          note: `All required parts received from purchase order ${poId}`,
        });
      }
    }
  }

  return updatedPO;
}
