import { db } from "@/lib/db";
import { NotFoundError, ConflictError, ValidationError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import type { PublicSlot } from "@/lib/contracts/public";

/**
 * Parses time string "HH:MM" into minutes from start of day.
 */
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":").map((p) => parseInt(p, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    throw new ValidationError(`Invalid time format: ${timeStr}. Expected HH:MM.`);
  }
  return parts[0] * 60 + parts[1];
}

/**
 * Generates slot start timestamps in UTC for a shop on a specified date (YYYY-MM-DD).
 */
export function calculateSlotStarts(
  dateStr: string,
  workStart: string,
  workEnd: string,
  slotMinutes: number
): Date[] {
  const dateParts = dateStr.split("-").map((p) => parseInt(p, 10));
  if (dateParts.length !== 3 || isNaN(dateParts[0]) || isNaN(dateParts[1]) || isNaN(dateParts[2])) {
    throw new ValidationError(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = dateParts;
  const startM = parseTimeToMinutes(workStart);
  const endM = parseTimeToMinutes(workEnd);

  if (slotMinutes <= 0) {
    throw new ValidationError("slotMinutes must be greater than 0");
  }

  if (startM >= endM) {
    throw new ValidationError("workStart must be before workEnd");
  }

  const slotStarts: Date[] = [];
  for (let currentM = startM; currentM + slotMinutes <= endM; currentM += slotMinutes) {
    const hours = Math.floor(currentM / 60);
    const minutes = currentM % 60;
    const slotDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
    slotStarts.push(slotDate);
  }

  return slotStarts;
}

/**
 * Materializes and ensures Slot records exist in the database for the given shop and date.
 */
export async function materializeShopSlots(shopId: string, dateStr: string) {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      workStart: true,
      workEnd: true,
      slotMinutes: true,
      slotCapacity: true,
    },
  });

  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const slotStarts = calculateSlotStarts(
    dateStr,
    shop.workStart,
    shop.workEnd,
    shop.slotMinutes
  );

  if (slotStarts.length === 0) {
    return [];
  }

  const [year, month, day] = dateStr.split("-").map((p) => parseInt(p, 10));
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  // Find existing slot records for that day
  const existingSlots = await db.slot.findMany({
    where: {
      shopId,
      startsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const existingTimes = new Set(existingSlots.map((s) => s.startsAt.getTime()));
  const missingSlotsData = slotStarts
    .filter((st) => !existingTimes.has(st.getTime()))
    .map((startsAt) => ({
      shopId,
      startsAt,
      capacity: shop.slotCapacity,
      booked: 0,
    }));

  if (missingSlotsData.length > 0) {
    await db.slot.createMany({
      data: missingSlotsData,
      skipDuplicates: true,
    });
  }

  // Return all current slots for the day sorted by startsAt
  return db.slot.findMany({
    where: {
      shopId,
      startsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: {
      startsAt: "asc",
    },
  });
}

/**
 * Returns only slots with remaining capacity (booked < capacity) for public booking.
 */
export async function getPublicShopSlots(
  shopId: string,
  dateStr: string
): Promise<PublicSlot[]> {
  const allSlots = await materializeShopSlots(shopId, dateStr);

  const availableSlots = allSlots.filter((slot) => slot.booked < slot.capacity);

  return availableSlots.map((slot) => ({
    id: slot.id,
    shopId: slot.shopId,
    startsAt: slot.startsAt.toISOString(),
    capacity: slot.capacity,
    booked: slot.booked,
    available: true,
  }));
}

/**
 * Atomically reserves a capacity unit for a slot in a transaction.
 * Throws ConflictError if remaining capacity is 0 or concurrent reservation wins.
 */
export async function claimSlotCapacity(
  tx: Prisma.TransactionClient,
  slotId: string,
  shopId: string
) {
  const slot = await tx.slot.findFirst({
    where: { id: slotId, shopId },
  });

  if (!slot) {
    throw new NotFoundError("Selected appointment slot not found in this shop");
  }

  if (slot.booked >= slot.capacity) {
    throw new ConflictError("Selected appointment slot is fully booked");
  }

  // Atomic conditional update to guard against race conditions
  const result = await tx.slot.updateMany({
    where: {
      id: slotId,
      shopId,
      booked: { lt: slot.capacity },
    },
    data: {
      booked: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new ConflictError("Appointment slot was just booked by another customer. Please choose another slot.");
  }

  return tx.slot.findUniqueOrThrow({
    where: { id: slotId },
  });
}
