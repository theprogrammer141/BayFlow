import type { Prisma } from "@/generated/prisma/client";
import { ConflictError, ValidationError } from "@/lib/errors";
import { createPurchaseOrderInTransaction } from "@/lib/services/inventory";
import { registerEffect, type EffectContext } from "@/lib/state/effects";

async function requiredParts(tx: Prisma.TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { estimate: { include: { items: true } } } });
  if (!booking?.estimate) throw new ValidationError("Booking has no estimate");
  const quantities = new Map<string, number>();
  for (const item of booking.estimate.items) if (item.partId) quantities.set(item.partId, (quantities.get(item.partId) ?? 0) + item.quantity);
  return { booking, quantities };
}

async function assertStockAvailable(tx: Prisma.TransactionClient, bookingId: string) {
  const { booking, quantities } = await requiredParts(tx, bookingId);
  const parts = await tx.part.findMany({ where: { shopId: booking.shopId, id: { in: [...quantities.keys()] } } });
  for (const [partId, quantity] of quantities) {
    const part = parts.find((candidate) => candidate.id === partId);
    if (!part || part.quantity < quantity) throw new ConflictError("Insufficient stock for required parts");
  }
  return { booking, quantities };
}

export async function releaseAllocations(tx: Prisma.TransactionClient, bookingId: string): Promise<void> {
  const allocations = await tx.allocation.findMany({ where: { bookingId, releasedAt: null } });
  for (const allocation of allocations) {
    const claimed = await tx.allocation.updateMany({ where: { id: allocation.id, releasedAt: null }, data: { releasedAt: new Date() } });
    if (claimed.count === 1) await tx.part.update({ where: { id: allocation.partId }, data: { quantity: { increment: allocation.quantity } } });
  }
}

export async function allocateParts(tx: Prisma.TransactionClient, bookingId: string) {
  const { booking, quantities } = await assertStockAvailable(tx, bookingId);
  const activeAllocations = await tx.allocation.count({ where: { bookingId, releasedAt: null } });
  if (activeAllocations > 0) throw new ConflictError("Parts have already been allocated for this booking");

  for (const [partId, quantity] of quantities) {
    const updated = await tx.part.updateMany({ where: { id: partId, shopId: booking.shopId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
    if (updated.count !== 1) throw new ConflictError("Insufficient stock for required parts");
    await tx.allocation.create({ data: { shopId: booking.shopId, bookingId, partId, quantity } });
  }
}

registerEffect("PARTS_PENDING->PARTS_ORDERED", async (tx, ctx) => {
  const { booking, quantities } = await requiredParts(tx, ctx.booking.id);
  const parts = await tx.part.findMany({ where: { shopId: booking.shopId, id: { in: [...quantities.keys()] } } });
  const items = [...quantities.entries()].map(([partId, quantity]) => {
    const part = parts.find((candidate) => candidate.id === partId);
    if (!part) throw new ValidationError("Estimate references a part outside this shop");
    const shortage = Math.max(0, quantity - part.quantity);
    return { partId, bookingId: booking.id, qtyOrdered: shortage };
  }).filter((item) => item.qtyOrdered > 0);
  if (items.length === 0) throw new ValidationError("No parts shortage exists");
  await createPurchaseOrderInTransaction(tx, ctx.actor.id, booking.shopId, { items });
});

registerEffect("PARTS_READY->IN_REPAIR", async (tx, ctx) => {
  await allocateParts(tx, ctx.booking.id);
});

registerEffect("PARTS_PENDING->PARTS_READY", async (tx, ctx) => {
  await assertStockAvailable(tx, ctx.booking.id);
});

registerEffect("PARTS_ORDERED->PARTS_READY", async (tx, ctx) => {
  await assertStockAvailable(tx, ctx.booking.id);
});

for (const key of ["PENDING", "CONFIRMED", "ASSIGNED", "INSPECTING", "ESTIMATE_REVIEW", "AWAITING_CUSTOMER", "ESTIMATE_APPROVED", "ESTIMATE_REJECTED", "PARTS_PENDING", "PARTS_ORDERED", "PARTS_READY"]) {
  registerEffect(`${key}->CANCELLED`, async (tx, ctx: EffectContext) => releaseAllocations(tx, ctx.booking.id));
}