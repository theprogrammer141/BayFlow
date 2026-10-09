import { describe, it, expect } from "vitest";
import {
  createUser,
  createShop,
  createSlot,
  createBooking,
} from "./factories";
import { transitionBooking } from "@/lib/services/booking-state";
import { db } from "@/lib/db";
import { InvalidTransitionError, ForbiddenError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";

describe("Customer Portal Transitions & Ownership Security", () => {
  it("allows customer to approve estimate when booking is in AWAITING_CUSTOMER", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const customer = await createUser({ isCustomer: true, name: "Approving Customer" });

    const booking = await createBooking(shop.id, customer.id, {
      slotId: slot.id,
      status: "AWAITING_CUSTOMER",
    });

    // Create an estimate in AWAITING_CUSTOMER
    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 15000,
        sentAt: new Date(),
        items: {
          create: [
            { type: "PART", name: "Oil Filter", quantity: 1, unitCost: 3000 },
            { type: "LABOUR", name: "Oil Service", quantity: 1, unitCost: 12000 },
          ],
        },
      },
    });

    const customerActor: AuthUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      isCustomer: true,
      memberships: [],
    };

    const res = await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_APPROVED",
      actor: customerActor,
      note: "Customer approved estimate online",
    });

    expect(res.to).toBe("ESTIMATE_APPROVED");
    expect(res.booking.status).toBe("ESTIMATE_APPROVED");

    const estimate = await db.estimate.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(estimate.approvedAt).toBeInstanceOf(Date);
  });

  it("allows customer to decline estimate when booking is in AWAITING_CUSTOMER", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const customer = await createUser({ isCustomer: true, name: "Declining Customer" });

    const booking = await createBooking(shop.id, customer.id, {
      slotId: slot.id,
      status: "AWAITING_CUSTOMER",
    });

    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 20000,
        sentAt: new Date(),
      },
    });

    const customerActor: AuthUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      isCustomer: true,
      memberships: [],
    };

    const res = await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_REJECTED",
      actor: customerActor,
      note: "Too expensive, please revise parts",
    });

    expect(res.to).toBe("ESTIMATE_REJECTED");
    expect(res.booking.status).toBe("ESTIMATE_REJECTED");

    const estimate = await db.estimate.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(estimate.rejectedAt).toBeInstanceOf(Date);
  });

  it("rejects estimate approval or rejection outside of AWAITING_CUSTOMER with 409", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const customer = await createUser({ isCustomer: true });

    // Status is PENDING
    const booking = await createBooking(shop.id, customer.id, {
      slotId: slot.id,
      status: "PENDING",
    });

    const customerActor: AuthUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      isCustomer: true,
      memberships: [],
    };

    // Attempt approve in PENDING -> 409 INVALID_TRANSITION
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ESTIMATE_APPROVED",
        actor: customerActor,
      })
    ).rejects.toThrow(InvalidTransitionError);

    // Attempt reject in PENDING -> 409 INVALID_TRANSITION
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ESTIMATE_REJECTED",
        actor: customerActor,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("prevents a customer from transitioning another customer's booking with 403 Forbidden", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const customerA = await createUser({ isCustomer: true, name: "Customer A" });
    const customerB = await createUser({ isCustomer: true, name: "Customer B" });

    const bookingA = await createBooking(shop.id, customerA.id, {
      slotId: slot.id,
      status: "AWAITING_CUSTOMER",
    });

    const customerBActor: AuthUser = {
      id: customerB.id,
      email: customerB.email,
      name: customerB.name,
      phone: customerB.phone,
      isCustomer: true,
      memberships: [],
    };

    // Customer B attempts to approve Customer A's estimate -> 403 Forbidden
    await expect(
      transitionBooking({
        bookingId: bookingA.id,
        to: "ESTIMATE_APPROVED",
        actor: customerBActor,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("allows customer to mark booking as completed when in READY_FOR_PICKUP", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const customer = await createUser({ isCustomer: true, name: "Pickup Customer" });

    const booking = await createBooking(shop.id, customer.id, {
      slotId: slot.id,
      status: "READY_FOR_PICKUP",
    });

    const customerActor: AuthUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      isCustomer: true,
      memberships: [],
    };

    const res = await transitionBooking({
      bookingId: booking.id,
      to: "COMPLETED",
      actor: customerActor,
      note: "Customer picked up vehicle from workshop",
    });

    expect(res.to).toBe("COMPLETED");
    expect(res.booking.status).toBe("COMPLETED");
    expect(res.booking.completedAt).toBeInstanceOf(Date);
  });

  it("allows customer to cancel booking in PENDING status", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const customer = await createUser({ isCustomer: true, name: "Cancelling Customer" });

    const booking = await createBooking(shop.id, customer.id, {
      slotId: slot.id,
      status: "PENDING",
    });

    const customerActor: AuthUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      isCustomer: true,
      memberships: [],
    };

    const res = await transitionBooking({
      bookingId: booking.id,
      to: "CANCELLED",
      actor: customerActor,
      note: "Customer cancelled appointment online",
    });

    expect(res.to).toBe("CANCELLED");
    expect(res.booking.status).toBe("CANCELLED");
  });
});
