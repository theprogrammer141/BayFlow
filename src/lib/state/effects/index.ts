import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/lib/errors";
import {
  registerEffect,
  getEffect,
  type EffectContext,
  type EffectFn,
} from "./registry";

export { registerEffect, getEffect };
export type { EffectContext, EffectFn };


/**
 * Idempotent release of allocated parts back to stock on cancellation.
 */
export async function releaseBookingAllocations(
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
// Core effects registration for Phase 1 (Statuses 1-6d & Cancel)
// -------------------------------------------------------------

// Row 1b: PENDING -> CANCELLED
registerEffect("PENDING->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});

// Row 2: CONFIRMED -> ASSIGNED (Set technicianId)
registerEffect("CONFIRMED->ASSIGNED", async (tx, ctx) => {
  const technicianId = (ctx.payload?.technicianId as string) || undefined;
  if (!technicianId) {
    throw new ValidationError("technicianId is required in payload");
  }

  await tx.booking.update({
    where: { id: ctx.booking.id },
    data: { technicianId },
  });
});

// Row 4: INSPECTING -> ESTIMATE_REVIEW (Create Estimate revision 1)
registerEffect("INSPECTING->ESTIMATE_REVIEW", async (tx, ctx) => {
  const rawItems = (ctx.payload?.items || ctx.payload?.estimateItems) as
    | Array<{ type: "PART" | "LABOUR"; name: string; quantity: number; unitCost: number; partId?: string }>
    | undefined;

  let estimate = ctx.booking.estimate;

  if (rawItems && rawItems.length > 0) {
    const total = rawItems.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);

    if (estimate) {
      await tx.estimateItem.deleteMany({ where: { estimateId: estimate.id } });
      estimate = await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          revision: 1,
          total,
          items: {
            create: rawItems.map((item) => ({
              type: item.type,
              name: item.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              partId: item.partId ?? null,
            })),
          },
        },
        include: { items: true },
      });
    } else {
      estimate = await tx.estimate.create({
        data: {
          bookingId: ctx.booking.id,
          revision: 1,
          total,
          items: {
            create: rawItems.map((item) => ({
              type: item.type,
              name: item.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              partId: item.partId ?? null,
            })),
          },
        },
        include: { items: true },
      });
    }
  }

  if (!estimate || !estimate.items || estimate.items.length === 0) {
    throw new ValidationError(
      "An estimate with at least one line item is required to submit for review"
    );
  }
});

// Row 5: ESTIMATE_REVIEW -> AWAITING_CUSTOMER (Lock estimate version)
registerEffect("ESTIMATE_REVIEW->AWAITING_CUSTOMER", async (tx, ctx) => {
  if (!ctx.booking.estimate) {
    throw new ValidationError("Booking has no estimate to send to customer");
  }

  const items = await tx.estimateItem.findMany({
    where: { estimateId: ctx.booking.estimate.id },
  });

  if (items.length === 0) {
    throw new ValidationError("Estimate must have at least one line item");
  }

  const recomputedTotal = items.reduce(
    (acc, item) => acc + item.quantity * item.unitCost,
    0
  );

  await tx.estimate.update({
    where: { id: ctx.booking.estimate.id },
    data: {
      total: recomputedTotal,
      sentAt: new Date(),
    },
  });
});

// Row 6a: AWAITING_CUSTOMER -> ESTIMATE_APPROVED (Store approvedAt)
registerEffect("AWAITING_CUSTOMER->ESTIMATE_APPROVED", async (tx, ctx) => {
  if (ctx.booking.estimate) {
    await tx.estimate.update({
      where: { id: ctx.booking.estimate.id },
      data: { approvedAt: new Date(), rejectedAt: null },
    });
  }
});

// Row 6b: AWAITING_CUSTOMER -> ESTIMATE_REJECTED (Store rejectedAt)
registerEffect("AWAITING_CUSTOMER->ESTIMATE_REJECTED", async (tx, ctx) => {
  if (ctx.booking.estimate) {
    await tx.estimate.update({
      where: { id: ctx.booking.estimate.id },
      data: { rejectedAt: new Date(), approvedAt: null },
    });
  }
});

// Row 6c: ESTIMATE_REJECTED -> ESTIMATE_REVIEW (estimate.revision += 1)
registerEffect("ESTIMATE_REJECTED->ESTIMATE_REVIEW", async (tx, ctx) => {
  if (ctx.booking.estimate) {
    await tx.estimate.update({
      where: { id: ctx.booking.estimate.id },
      data: {
        revision: { increment: 1 },
        rejectedAt: null,
      },
    });
  }
});

// Pre-IN_REPAIR cancellation transitions (Rows 1b, 6d and pre-repair cancellations)
registerEffect("ESTIMATE_REJECTED->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("CONFIRMED->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("ASSIGNED->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("INSPECTING->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("ESTIMATE_REVIEW->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("AWAITING_CUSTOMER->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("ESTIMATE_APPROVED->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("PARTS_PENDING->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("PARTS_ORDERED->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});
registerEffect("PARTS_READY->CANCELLED", async (tx, ctx) => {
  await releaseBookingAllocations(tx, ctx.booking.id);
});

// Row 7: ESTIMATE_APPROVED -> PARTS_PENDING (Set partsPersonId)
registerEffect("ESTIMATE_APPROVED->PARTS_PENDING", async (tx, ctx) => {
  const partsPersonId = (ctx.payload?.partsPersonId as string) || undefined;
  if (partsPersonId) {
    await tx.booking.update({
      where: { id: ctx.booking.id },
      data: { partsPersonId },
    });
  }
});

// Row 14: READY_FOR_PICKUP -> COMPLETED (Set completedAt)
registerEffect("READY_FOR_PICKUP->COMPLETED", async (tx, ctx) => {
  await tx.booking.update({
    where: { id: ctx.booking.id },
    data: { completedAt: new Date() },
  });
});

// Import parts effects module to register rows 8a, 8b, 9, 10
import "./parts";
export { releaseAllocations } from "./parts";

// Import QC effects module to register QC transitions
import "./qc";

