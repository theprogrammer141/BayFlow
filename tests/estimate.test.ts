import { describe, it, expect } from "vitest";
import { createUser, createShop, createMembership, createBooking, createBookingInStatus } from "./factories";
import { getBookingEstimate, saveBookingEstimate } from "@/lib/services/estimate";
import { transitionBooking } from "@/lib/services/booking-state";
import { ForbiddenError, ConflictError, NotFoundError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";
import { db } from "@/lib/db";

import type { Role } from "@/lib/contracts/common";

function toAuthUser(
  user: { id: string; email: string; name: string; phone?: string | null; isCustomer: boolean },
  memberships: Array<{ id: string; shopId: string; role: Role; isActive: boolean }> = []
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? null,
    isCustomer: user.isCustomer,
    memberships,
  };
}

describe("Estimate Service & API Unit/Integration Tests", () => {
  it("allows assigned technician to edit estimate in INSPECTING and computes integer PKR total server-side", async () => {
    const owner = await createUser({ name: "Shop Owner" });
    const shop = await createShop(owner.id);
    const tech = await createUser({ name: "Assigned Tech" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");

    const otherTech = await createUser({ name: "Other Tech" });
    await createMembership(otherTech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ name: "Customer Z", isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "INSPECTING",
      technicianId: tech.id,
    });

    const authTech = toAuthUser(tech, [techMem]);
    const authOtherTech = toAuthUser(otherTech);

    // 1. Assigned tech saves estimate items
    const estimate = await saveBookingEstimate(authTech, shop.id, booking.id, {
      items: [
        {
          type: "PART",
          name: "Front Brake Pads",
          quantity: 2,
          unitCost: 3500, // 2 * 3500 = 7000
        },
        {
          type: "LABOUR",
          name: "Brake Pad Installation",
          quantity: 1,
          unitCost: 2000, // 1 * 2000 = 2000
        },
      ],
    });

    expect(estimate.id).toBeDefined();
    expect(estimate.revision).toBe(1);
    expect(estimate.total).toBe(9000); // 7000 + 2000 = 9000 PKR
    expect(estimate.items.length).toBe(2);

    // 2. Another technician cannot edit this estimate -> 403 Forbidden
    await expect(
      saveBookingEstimate(authOtherTech, shop.id, booking.id, {
        items: [{ type: "LABOUR", name: "Extra Labour", quantity: 1, unitCost: 1000 }],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("allows SA to edit estimate in ESTIMATE_REVIEW and increments revision", async () => {
    const owner = await createUser({ name: "Shop Owner" });
    const shop = await createShop(owner.id);
    const sa = await createUser({ name: "Service Advisor" });
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const tech = await createUser({ name: "Tech" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ name: "Customer A", isCustomer: true });

    // Booking in ESTIMATE_REVIEW with existing estimate revision 1
    const booking = await createBookingInStatus(shop.id, customer.id, "ESTIMATE_REVIEW", {
      technicianId: tech.id,
      createEstimate: true,
      estimateTotal: 10000,
    });

    const authSa = toAuthUser(sa, [saMem]);
    const authTech = toAuthUser(tech, [techMem]);

    // 1. Technician cannot edit estimate while in ESTIMATE_REVIEW
    await expect(
      saveBookingEstimate(authTech, shop.id, booking.id, {
        items: [{ type: "LABOUR", name: "Labour", quantity: 1, unitCost: 5000 }],
      })
    ).rejects.toThrow(ForbiddenError);

    // 2. SA edits estimate -> total recalculated and revision incremented from 1 to 2
    const updated = await saveBookingEstimate(authSa, shop.id, booking.id, {
      items: [
        {
          type: "PART",
          name: "Spark Plugs (Set of 4)",
          quantity: 4,
          unitCost: 1500, // 6000
        },
        {
          type: "LABOUR",
          name: "Tune-up labour",
          quantity: 2,
          unitCost: 2500, // 5000
        },
      ],
    });

    expect(updated.revision).toBe(2);
    expect(updated.total).toBe(11000); // 6000 + 5000 = 11000 PKR
    expect(updated.items.length).toBe(2);
  });

  it("enforces estimate locking once sent to customer", async () => {
    const owner = await createUser({ name: "Owner" });
    const shop = await createShop(owner.id);
    const sa = await createUser({ name: "SA" });
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const customer = await createUser({ name: "Customer B", isCustomer: true });

    // Booking in ESTIMATE_REVIEW with estimate
    const booking = await createBookingInStatus(shop.id, customer.id, "ESTIMATE_REVIEW", {
      createEstimate: true,
      estimateTotal: 10000,
    });

    const authSa = toAuthUser(sa, [saMem]);

    // Transition ESTIMATE_REVIEW -> AWAITING_CUSTOMER (locks estimate with sentAt)
    await transitionBooking({
      bookingId: booking.id,
      to: "AWAITING_CUSTOMER",
      actor: authSa,
    });

    const estimateAfterSend = await db.estimate.findUniqueOrThrow({
      where: { bookingId: booking.id },
    });
    expect(estimateAfterSend.sentAt).not.toBeNull();

    // Trying to edit estimate lines while in AWAITING_CUSTOMER must fail with Conflict (locked)
    await expect(
      saveBookingEstimate(authSa, shop.id, booking.id, {
        items: [{ type: "LABOUR", name: "Sneaky addition", quantity: 1, unitCost: 5000 }],
      })
    ).rejects.toThrow(ConflictError);
  });

  it("enforces estimate read access for customer and staff, rejecting unauthorized users", async () => {
    const owner = await createUser({ name: "Shop Owner" });
    const shop = await createShop(owner.id);
    const sa = await createUser({ name: "SA" });
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const customer = await createUser({ name: "Customer Owner of Booking", isCustomer: true });
    const otherCustomer = await createUser({ name: "Stranger Customer", isCustomer: true });

    const booking = await createBookingInStatus(shop.id, customer.id, "ESTIMATE_REVIEW", {
      createEstimate: true,
      estimateTotal: 15000,
    });

    const authSa = toAuthUser(sa, [saMem]);
    const authCustomer = toAuthUser(customer);
    const authStranger = toAuthUser(otherCustomer);

    // 1. Authorized SA can read estimate
    const saRead = await getBookingEstimate(authSa, shop.id, booking.id);
    expect(saRead.total).toBe(15000);

    // 2. Booking customer can read estimate
    const customerRead = await getBookingEstimate(authCustomer, shop.id, booking.id);
    expect(customerRead.total).toBe(15000);

    // 3. Unauthorized stranger customer cannot read estimate -> 403 Forbidden
    await expect(
      getBookingEstimate(authStranger, shop.id, booking.id)
    ).rejects.toThrow(ForbiddenError);

    // 4. Nonexistent booking -> 404 NotFound
    await expect(
      getBookingEstimate(authSa, shop.id, "nonexistent_booking_id")
    ).rejects.toThrow(NotFoundError);
  });
});
