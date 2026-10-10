import { describe, it, expect } from "vitest";
import {
  createUser,
  createShop,
  createBooking,
  createMembership,
  createPart as createPartFactory,
} from "./factories";
import {
  getShopParts,
  createPart,
  updatePart,
  checkBookingParts,
} from "@/lib/services/parts";
import {
  getShopPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
} from "@/lib/services/purchase-orders";
import { transitionBooking } from "@/lib/services/booking-state";
import { getShopBookings } from "@/lib/services/bookings";
import { releaseAllocations } from "@/lib/state/effects/parts";
import { db } from "@/lib/db";
import {
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";
import type { Role } from "@/lib/contracts/common";

function toAuthStaff(
  user: { id: string; email: string; name: string; phone?: string | null },
  membership: { id: string; shopId: string; role: Role; isActive: boolean }
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? null,
    isCustomer: false,
    memberships: [
      {
        id: membership.id,
        shopId: membership.shopId,
        role: membership.role,
        isActive: membership.isActive,
      },
    ],
  };
}

describe("Phase 06 — Inventory, Purchase Orders and Parts Management Integration Tests", () => {
  it("Acceptance Check 1: In-stock job moves from PARTS_PENDING to PARTS_READY without PO", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const partsPerson = await createUser({ name: "Parts Specialist" });
    const partsMem = await createMembership(partsPerson.id, shop.id, "PARTS_PERSON");
    const authParts = toAuthStaff(partsPerson, partsMem);

    const customer = await createUser({ isCustomer: true });
    const part = await createPartFactory(shop.id, {
      name: "Ceramic Brake Pads",
      sku: "BRK-PAD-001",
      quantity: 10,
      reorderLevel: 2,
      cost: 4500,
    });

    const booking = await createBooking(shop.id, customer.id, {
      status: "PARTS_PENDING",
      partsPersonId: partsPerson.id,
    });

    // Create estimate with in-stock part (requires 2, stock is 10)
    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 9000,
        items: {
          create: [
            {
              type: "PART",
              name: "Ceramic Brake Pads",
              partId: part.id,
              quantity: 2,
              unitCost: 4500,
            },
          ],
        },
      },
    });

    // 1. Shortage check verifies no shortage
    const check = await checkBookingParts(authParts, shop.id, booking.id);
    expect(check.hasShortage).toBe(false);
    expect(check.items[0].shortage).toBe(0);
    expect(check.items[0].availableQty).toBe(10);
    expect(check.items[0].requiredQty).toBe(2);

    // 2. Transition directly from PARTS_PENDING to PARTS_READY
    const result = await transitionBooking({
      bookingId: booking.id,
      to: "PARTS_READY",
      actor: authParts,
    });

    expect(result.to).toBe("PARTS_READY");

    // 3. Confirm no purchase order was created for this booking
    const poItems = await db.purchaseOrderItem.findMany({
      where: { bookingId: booking.id },
    });
    expect(poItems.length).toBe(0);
  });

  it("Acceptance Check 2 & 3: Partial receipt keeps PARTS_ORDERED, full receipt advances to PARTS_READY", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const partsPerson = await createUser({ name: "Parts Specialist" });
    const partsMem = await createMembership(partsPerson.id, shop.id, "PARTS_PERSON");
    const authParts = toAuthStaff(partsPerson, partsMem);

    const customer = await createUser({ isCustomer: true });
    // Stock is 1, required will be 5 -> shortage of 4
    const part = await createPartFactory(shop.id, {
      name: "Synthetic Motor Oil 5W30",
      sku: "OIL-5W30-SYN",
      quantity: 1,
      reorderLevel: 5,
      cost: 3000,
    });

    const booking = await createBooking(shop.id, customer.id, {
      status: "PARTS_PENDING",
      partsPersonId: partsPerson.id,
    });

    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 15000,
        items: {
          create: [
            {
              type: "PART",
              name: "Synthetic Motor Oil 5W30",
              partId: part.id,
              quantity: 5,
              unitCost: 3000,
            },
          ],
        },
      },
    });

    // 1. Shortage check verifies shortage of 4
    const check = await checkBookingParts(authParts, shop.id, booking.id);
    expect(check.hasShortage).toBe(true);
    expect(check.items[0].shortage).toBe(4);

    // 2. Transition from PARTS_PENDING to PARTS_ORDERED
    const orderedTransition = await transitionBooking({
      bookingId: booking.id,
      to: "PARTS_ORDERED",
      actor: authParts,
    });
    expect(orderedTransition.to).toBe("PARTS_ORDERED");

    // Verify PO was created automatically for the shortage
    const pos = await getShopPurchaseOrders(authParts, shop.id);
    const po = pos.find((p) => p.items.some((i) => i.bookingId === booking.id));
    expect(po).toBeDefined();
    expect(po?.status).toBe("ORDERED");
    const poItem = po!.items.find((i) => i.bookingId === booking.id)!;
    expect(poItem.qtyOrdered).toBe(4);
    expect(poItem.qtyReceived).toBe(0);

    // 3. Partial receipt: receive 2 units out of 4
    const partialRecResult = await receivePurchaseOrder(
      authParts,
      shop.id,
      po!.id,
      {
        items: [{ itemId: poItem.id, qty: 2 }],
      }
    );

    expect(partialRecResult.status).toBe("PARTIALLY_RECEIVED");
    expect(partialRecResult.items[0].qtyReceived).toBe(2);

    // Stock increased from 1 to 3
    const partAfterPartial = await db.part.findUniqueOrThrow({
      where: { id: part.id },
    });
    expect(partAfterPartial.quantity).toBe(3);

    // Booking must remain in PARTS_ORDERED
    const bookingAfterPartial = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(bookingAfterPartial.status).toBe("PARTS_ORDERED");

    // 4. Full receipt: receive remaining 2 units
    const fullRecResult = await receivePurchaseOrder(
      authParts,
      shop.id,
      po!.id,
      {
        items: [{ itemId: poItem.id, qty: 2 }],
      }
    );

    expect(fullRecResult.status).toBe("RECEIVED");
    expect(fullRecResult.items[0].qtyReceived).toBe(4);

    // Stock increased from 3 to 5
    const partAfterFull = await db.part.findUniqueOrThrow({
      where: { id: part.id },
    });
    expect(partAfterFull.quantity).toBe(5);

    // Booking automatically advances to PARTS_READY once all parts are received
    const bookingAfterFull = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(bookingAfterFull.status).toBe("PARTS_READY");
  });

  it("Acceptance Check 4: Stock allocation, negative stock prevention, and idempotent release", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const partsPerson = await createUser({ name: "Parts Specialist" });
    const partsMem = await createMembership(partsPerson.id, shop.id, "PARTS_PERSON");
    const authParts = toAuthStaff(partsPerson, partsMem);

    const customer = await createUser({ isCustomer: true });
    const part = await createPartFactory(shop.id, {
      name: "Spark Plugs Set",
      sku: "SPK-PLG-004",
      quantity: 4,
      cost: 2000,
    });

    const booking = await createBooking(shop.id, customer.id, {
      status: "PARTS_READY",
      partsPersonId: partsPerson.id,
    });

    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 8000,
        items: {
          create: [
            {
              type: "PART",
              name: "Spark Plugs Set",
              partId: part.id,
              quantity: 4,
              unitCost: 2000,
            },
          ],
        },
      },
    });

    // 1. Transition PARTS_READY -> IN_REPAIR deducts stock and creates Allocation
    const repairTransition = await transitionBooking({
      bookingId: booking.id,
      to: "IN_REPAIR",
      actor: authParts,
    });
    expect(repairTransition.to).toBe("IN_REPAIR");

    // Stock should now be 0 (4 - 4)
    const partAfterAlloc = await db.part.findUniqueOrThrow({
      where: { id: part.id },
    });
    expect(partAfterAlloc.quantity).toBe(0);

    // Allocation record created
    const allocations = await db.allocation.findMany({
      where: { bookingId: booking.id, releasedAt: null },
    });
    expect(allocations.length).toBe(1);
    expect(allocations[0].quantity).toBe(4);
    expect(allocations[0].partId).toBe(part.id);

    // 2. Reject another allocation that would make stock negative
    const booking2 = await createBooking(shop.id, customer.id, {
      status: "PARTS_READY",
      partsPersonId: partsPerson.id,
    });
    await db.estimate.create({
      data: {
        bookingId: booking2.id,
        revision: 1,
        total: 2000,
        items: {
          create: [
            {
              type: "PART",
              name: "Spark Plugs Set",
              partId: part.id,
              quantity: 1,
              unitCost: 2000,
            },
          ],
        },
      },
    });

    // Stock is 0; allocating 1 would make it negative -> must reject with ConflictError
    await expect(
      transitionBooking({
        bookingId: booking2.id,
        to: "IN_REPAIR",
        actor: authParts,
      })
    ).rejects.toThrow(ConflictError);

    // Stock remains 0
    const partUnchanged = await db.part.findUniqueOrThrow({
      where: { id: part.id },
    });
    expect(partUnchanged.quantity).toBe(0);

    // 3. Test idempotent releaseAllocations
    await db.$transaction(async (tx) => {
      await releaseAllocations(tx, booking.id);
    });

    // Stock restored from 0 to 4
    const partAfterRelease = await db.part.findUniqueOrThrow({
      where: { id: part.id },
    });
    expect(partAfterRelease.quantity).toBe(4);

    // Allocation marked released
    const releasedAlloc = await db.allocation.findUniqueOrThrow({
      where: { id: allocations[0].id },
    });
    expect(releasedAlloc.releasedAt).not.toBeNull();

    // Calling releaseAllocations a second time does not restore stock twice
    await db.$transaction(async (tx) => {
      await releaseAllocations(tx, booking.id);
    });

    const partAfterSecondRelease = await db.part.findUniqueOrThrow({
      where: { id: part.id },
    });
    expect(partAfterSecondRelease.quantity).toBe(4);
  });

  it("Acceptance Check 5: Shop isolation and role guards", async () => {
    const owner = await createUser();
    const shopA = await createShop(owner.id, { name: "Shop Alpha" });
    const shopB = await createShop(owner.id, { name: "Shop Beta" });

    const partsUserA = await createUser({ name: "Parts A" });
    const memA = await createMembership(partsUserA.id, shopA.id, "PARTS_PERSON");
    const authPartsA = toAuthStaff(partsUserA, memA);

    const techUserA = await createUser({ name: "Tech A" });
    const techMemA = await createMembership(techUserA.id, shopA.id, "TECHNICIAN");
    const authTechA = toAuthStaff(techUserA, techMemA);

    const partA = await createPartFactory(shopA.id, { sku: "PART-A-01" });
    const partB = await createPartFactory(shopB.id, { sku: "PART-B-01" });

    // 1. Staff in Shop A cannot query Shop B parts
    await expect(getShopParts(authPartsA, shopB.id)).rejects.toThrow(
      ForbiddenError
    );

    // 2. Staff in Shop A cannot query Shop B purchase orders
    await expect(getShopPurchaseOrders(authPartsA, shopB.id)).rejects.toThrow(
      ForbiddenError
    );

    // 3. Parts staff in Shop A can query Shop A bookings, but not Shop B bookings
    const bookingsA = await getShopBookings(authPartsA, shopA.id);
    expect(bookingsA.bookings).toBeDefined();
    await expect(getShopBookings(authPartsA, shopB.id)).rejects.toThrow(
      ForbiddenError
    );

    // 4. Technician cannot create or mutate parts
    await expect(
      createPart(authTechA, shopA.id, {
        sku: "TECH-PART-01",
        name: "Forbidden Part",
        quantity: 5,
        reorderLevel: 1,
        cost: 1000,
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      updatePart(authTechA, shopA.id, partA.id, {
        quantity: 20,
      })
    ).rejects.toThrow(ForbiddenError);

    // 4. Technician cannot create purchase orders
    await expect(
      createPurchaseOrder(authTechA, shopA.id, {
        items: [{ partId: partA.id, qtyOrdered: 5 }],
      })
    ).rejects.toThrow(ForbiddenError);

    // 5. Parts staff in Shop A cannot create PO for Shop B parts
    await expect(
      createPurchaseOrder(authPartsA, shopA.id, {
        items: [{ partId: partB.id, qtyOrdered: 5 }],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("Acceptance Check 6: Stock catalog invariants & custom estimate lines (D-013)", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const partsPerson = await createUser({ name: "Parts Specialist" });
    const partsMem = await createMembership(partsPerson.id, shop.id, "PARTS_PERSON");
    const authParts = toAuthStaff(partsPerson, partsMem);

    // 1. Create part
    const part = await createPart(authParts, shop.id, {
      sku: "AIR-FLT-2026",
      name: "High Flow Air Filter",
      quantity: 12,
      reorderLevel: 3,
      cost: 3500,
    });
    expect(part.sku).toBe("AIR-FLT-2026");

    // 2. Duplicate SKU in same shop rejected
    await expect(
      createPart(authParts, shop.id, {
        sku: "AIR-FLT-2026",
        name: "Duplicate SKU Part",
        quantity: 5,
        reorderLevel: 2,
        cost: 3000,
      })
    ).rejects.toThrow(ConflictError);

    // 3. Updating quantity to negative is rejected
    await expect(
      updatePart(authParts, shop.id, part.id, {
        quantity: -5,
      })
    ).rejects.toThrow(ConflictError);

    // 4. Custom estimate lines without partId participate in estimate but NOT stock check (D-013)
    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "PARTS_PENDING",
      partsPersonId: partsPerson.id,
    });

    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 10000,
        items: {
          create: [
            {
              type: "PART",
              name: "Custom Fabricated Bracket (No Part ID)",
              partId: null, // Custom line per D-013
              quantity: 2,
              unitCost: 5000,
            },
          ],
        },
      },
    });

    const check = await checkBookingParts(authParts, shop.id, booking.id);
    expect(check.hasShortage).toBe(false);
    expect(check.items.length).toBe(0); // custom line not tracked

    // Can transition directly to PARTS_READY
    const res = await transitionBooking({
      bookingId: booking.id,
      to: "PARTS_READY",
      actor: authParts,
    });
    expect(res.to).toBe("PARTS_READY");
  });
});
