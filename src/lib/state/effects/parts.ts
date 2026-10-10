import type { Prisma } from "@/generated/prisma/client";
import { registerEffect } from "./registry";
import { ConflictError, ValidationError } from "@/lib/errors";

/**
 * Idempotent release of allocated parts back to stock.
 * Exposed so the cancellation effect can safely release stock.
 */
export async function releaseAllocations(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<void> {
  const allocations = await tx.allocation.findMany({
    where: {
      bookingId,
      releasedAt: null,
    },
  });

  for (const alloc of allocations) {
    await tx.part.update({
      where: { id: alloc.partId },
      data: { quantity: { increment: alloc.quantity } },
    });

    await tx.allocation.update({
      where: { id: alloc.id },
      data: { releasedAt: new Date() },
    });
  }
}

// -------------------------------------------------------------
// Transition Effects for Parts Workflow (Rows 8a, 8b, 9, 10)
// -------------------------------------------------------------

/**
 * Row 8a: PARTS_PENDING -> PARTS_ORDERED
 * Guard: HAS_PARTS_SHORTAGE_AND_PO_CREATED
 * Creates a purchase order for missing items, or links an existing PO.
 * Rejects if there are no shortages (in-stock jobs should move to PARTS_READY).
 */
registerEffect("PARTS_PENDING->PARTS_ORDERED", async (tx, ctx) => {
  const booking = await tx.booking.findUnique({
    where: { id: ctx.booking.id },
    include: {
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });

  // Calculate required part quantities (lines of type PART with partId per D-013)
  const requiredByPart = new Map<string, number>();
  for (const item of booking?.estimate?.items || []) {
    if (item.type === "PART" && item.partId) {
      const current = requiredByPart.get(item.partId) || 0;
      requiredByPart.set(item.partId, current + item.quantity);
    }
  }

  const partIds = Array.from(requiredByPart.keys());
  const parts =
    partIds.length > 0
      ? await tx.part.findMany({
          where: { id: { in: partIds }, shopId: ctx.booking.shopId },
        })
      : [];

  const partMap = new Map(parts.map((p) => [p.id, p]));
  const shortages: Array<{ partId: string; shortage: number }> = [];

  for (const [partId, requiredQty] of requiredByPart.entries()) {
    const part = partMap.get(partId);
    const availableQty = part ? part.quantity : 0;
    const shortage = Math.max(0, requiredQty - availableQty);
    if (shortage > 0) {
      shortages.push({ partId, shortage });
    }
  }

  // If a purchaseOrderId was passed in payload, verify it
  const payloadPOId = ctx.payload?.purchaseOrderId as string | undefined;
  if (payloadPOId) {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: payloadPOId, shopId: ctx.booking.shopId },
    });
    if (!po) {
      throw new ValidationError("Provided purchase order does not exist in this shop");
    }
    return;
  }

  // If items were passed in payload, create PO from payload items
  const payloadItems = ctx.payload?.items as
    | Array<{ partId: string; qtyOrdered: number }>
    | undefined;

  if (payloadItems && payloadItems.length > 0) {
    await tx.purchaseOrder.create({
      data: {
        shopId: ctx.booking.shopId,
        createdById: ctx.actor.id,
        status: "ORDERED",
        items: {
          create: payloadItems.map((item) => ({
            partId: item.partId,
            bookingId: ctx.booking.id,
            qtyOrdered: item.qtyOrdered,
            qtyReceived: 0,
          })),
        },
      },
    });
    return;
  }

  // Otherwise, must have at least one shortage to create PO
  if (shortages.length === 0) {
    throw new ValidationError(
      "Cannot transition to PARTS_ORDERED: all required parts are already in stock. Transition to PARTS_READY instead."
    );
  }

  await tx.purchaseOrder.create({
    data: {
      shopId: ctx.booking.shopId,
      createdById: ctx.actor.id,
      status: "ORDERED",
      items: {
        create: shortages.map((s) => ({
          partId: s.partId,
          bookingId: ctx.booking.id,
          qtyOrdered: s.shortage,
          qtyReceived: 0,
        })),
      },
    },
  });
});

/**
 * Row 8b: PARTS_PENDING -> PARTS_READY
 * Guard: EVERY_REQUIRED_PART_IN_STOCK
 * Allowed only when every required part (estimate PART line with partId) has sufficient stock.
 */
registerEffect("PARTS_PENDING->PARTS_READY", async (tx, ctx) => {
  const booking = await tx.booking.findUnique({
    where: { id: ctx.booking.id },
    include: {
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });

  const requiredByPart = new Map<string, number>();
  for (const item of booking?.estimate?.items || []) {
    if (item.type === "PART" && item.partId) {
      const current = requiredByPart.get(item.partId) || 0;
      requiredByPart.set(item.partId, current + item.quantity);
    }
  }

  for (const [partId, requiredQty] of requiredByPart.entries()) {
    const part = await tx.part.findFirst({
      where: { id: partId, shopId: ctx.booking.shopId },
    });
    const available = part ? part.quantity : 0;
    if (available < requiredQty) {
      throw new ConflictError(
        `Cannot move to PARTS_READY: part '${part?.name || partId}' is short (required: ${requiredQty}, available: ${available})`
      );
    }
  }
});

/**
 * Row 9: PARTS_ORDERED -> PARTS_READY
 * Guard: ALL_PO_ITEMS_FULLY_RECEIVED
 * Verifies all PO items linked to this booking are fully received and required parts are in stock.
 */
registerEffect("PARTS_ORDERED->PARTS_READY", async (tx, ctx) => {
  // Check that all PO items linked to this booking are fully received
  const poItems = await tx.purchaseOrderItem.findMany({
    where: { bookingId: ctx.booking.id },
  });

  const hasUnreceived = poItems.some((item) => item.qtyReceived < item.qtyOrdered);
  if (hasUnreceived) {
    throw new ConflictError(
      "Cannot transition to PARTS_READY: not all purchase order items for this booking have been fully received"
    );
  }

  // Also verify required estimate parts have sufficient stock
  const booking = await tx.booking.findUnique({
    where: { id: ctx.booking.id },
    include: {
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });

  const requiredByPart = new Map<string, number>();
  for (const item of booking?.estimate?.items || []) {
    if (item.type === "PART" && item.partId) {
      const current = requiredByPart.get(item.partId) || 0;
      requiredByPart.set(item.partId, current + item.quantity);
    }
  }

  for (const [partId, requiredQty] of requiredByPart.entries()) {
    const part = await tx.part.findFirst({
      where: { id: partId, shopId: ctx.booking.shopId },
    });
    const available = part ? part.quantity : 0;
    if (available < requiredQty) {
      throw new ConflictError(
        `Cannot move to PARTS_READY: part '${part?.name || partId}' is short (required: ${requiredQty}, available: ${available})`
      );
    }
  }
});

/**
 * Row 10: PARTS_READY -> IN_REPAIR
 * Guard: STOCK_SUFFICIENT
 * Atomically deducts stock and creates Allocation records in the same transaction.
 * Rejects if allocation would make stock negative. Prevents double-allocation.
 */
registerEffect("PARTS_READY->IN_REPAIR", async (tx, ctx) => {
  // Prevent double-allocating
  const existingActiveAllocations = await tx.allocation.findFirst({
    where: {
      bookingId: ctx.booking.id,
      releasedAt: null,
    },
  });

  if (existingActiveAllocations) {
    throw new ConflictError("Parts have already been allocated for this booking");
  }

  const booking = await tx.booking.findUnique({
    where: { id: ctx.booking.id },
    include: {
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });

  const requiredByPart = new Map<string, number>();
  for (const item of booking?.estimate?.items || []) {
    if (item.type === "PART" && item.partId) {
      const current = requiredByPart.get(item.partId) || 0;
      requiredByPart.set(item.partId, current + item.quantity);
    }
  }

  // 1. Validate all parts have sufficient stock before mutating any stock
  for (const [partId, requiredQty] of requiredByPart.entries()) {
    const part = await tx.part.findFirst({
      where: { id: partId, shopId: ctx.booking.shopId },
    });

    if (!part || part.quantity < requiredQty) {
      throw new ConflictError(
        `Insufficient stock for part '${part?.name || partId}'. Stock cannot become negative.`
      );
    }
  }

  // 2. Atomically deduct stock and create Allocation records
  for (const [partId, requiredQty] of requiredByPart.entries()) {
    await tx.part.update({
      where: { id: partId },
      data: { quantity: { decrement: requiredQty } },
    });

    await tx.allocation.create({
      data: {
        shopId: ctx.booking.shopId,
        bookingId: ctx.booking.id,
        partId,
        quantity: requiredQty,
      },
    });
  }
});
