import { describe, it, expect } from "vitest";
import { createUser, createShop, createSlot } from "./factories";
import {
  calculateSlotStarts,
  getPublicShopSlots,
  claimSlotCapacity,
} from "@/lib/services/slots";
import { db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";

describe("Slot Engine & Capacity", () => {
  it("calculates slot timestamps according to shop working hours and slotMinutes", () => {
    // 09:00 to 12:00 with 60 min slots -> 09:00, 10:00, 11:00
    const starts = calculateSlotStarts("2026-10-15", "09:00", "12:00", 60);
    expect(starts.length).toBe(3);
    expect(starts[0].toISOString()).toBe("2026-10-15T09:00:00.000Z");
    expect(starts[1].toISOString()).toBe("2026-10-15T10:00:00.000Z");
    expect(starts[2].toISOString()).toBe("2026-10-15T11:00:00.000Z");

    // Partial interval that does not fit is excluded (e.g. 09:00 to 10:30 with 60 min -> only 09:00)
    const partialStarts = calculateSlotStarts("2026-10-15", "09:00", "10:30", 60);
    expect(partialStarts.length).toBe(1);
    expect(partialStarts[0].toISOString()).toBe("2026-10-15T09:00:00.000Z");
  });

  it("materializes slot records in database and returns only slots with remaining capacity", async () => {
    const owner = await createUser({ name: "Slot Test Owner" });
    const shop = await createShop(owner.id, {
      name: "Precision Slot Shop",
      workStart: "09:00",
      workEnd: "12:00",
      slotMinutes: 60,
      slotCapacity: 2,
    });

    const testDate = "2026-11-20";

    // First call materializes 3 slots: 09:00, 10:00, 11:00 with capacity=2, booked=0
    const slots = await getPublicShopSlots(shop.id, testDate);
    expect(slots.length).toBe(3);
    expect(slots.every((s) => s.available && s.capacity === 2 && s.booked === 0)).toBe(true);

    // Verify records exist in DB
    const dbSlots = await db.slot.findMany({ where: { shopId: shop.id } });
    expect(dbSlots.length).toBe(3);

    // Fill one slot to capacity (booked = 2)
    const fullSlotId = slots[0].id;
    await db.slot.update({
      where: { id: fullSlotId },
      data: { booked: 2 },
    });

    // Query again: the fully booked slot should be omitted (booked < capacity)
    const availableSlots = await getPublicShopSlots(shop.id, testDate);
    expect(availableSlots.length).toBe(2);
    expect(availableSlots.find((s) => s.id === fullSlotId)).toBeUndefined();
  });

  it("prevents overbooking under concurrent capacity claims", async () => {
    const owner = await createUser({ name: "Concurrency Slot Owner" });
    const shop = await createShop(owner.id, {
      slotCapacity: 2,
    });

    // Create a slot with capacity 2 and booked 1 (only 1 spot left)
    const slot = await createSlot(shop.id, {
      capacity: 2,
      booked: 1,
    });

    // Attempt two simultaneous claims for the single remaining spot
    const claimAttempts = [1, 2].map(async () => {
      return db.$transaction(async (tx) => {
        return claimSlotCapacity(tx, slot.id, shop.id);
      });
    });

    const results = await Promise.allSettled(claimAttempts);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one should succeed, and one should fail with ConflictError
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    }

    // Verify final booked count in DB is exactly 2, never exceeding capacity
    const finalSlot = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.booked).toBe(2);
  });
});
