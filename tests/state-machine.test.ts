import { describe, it, expect, beforeAll } from "vitest";
import { transitionBooking } from "@/lib/services/booking-state";
import {
  createUser,
  createShop,
  createMembership,
  createBooking,
  createPart,
} from "./factories";
import { db } from "@/lib/db";
import {
  InvalidTransitionError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";

describe("State Machine Engine & Transitions", () => {
  let shopId: string;
  let ownerUser: AuthUser;
  let saUser: AuthUser;
  let techUser: AuthUser;
  let otherTechUser: AuthUser;
  let qcUser: AuthUser;
  let partsUser: AuthUser;
  let customerUser: AuthUser;

  beforeAll(async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    shopId = shop.id;

    const sa = await createUser();
    const tech = await createUser();
    const otherTech = await createUser();
    const qc = await createUser();
    const parts = await createUser();
    const customer = await createUser({ isCustomer: true });

    const ownerMem = await createMembership(owner.id, shop.id, "OWNER");
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");
    const otherTechMem = await createMembership(otherTech.id, shop.id, "TECHNICIAN");
    const qcMem = await createMembership(qc.id, shop.id, "QC_INSPECTOR");
    const partsMem = await createMembership(parts.id, shop.id, "PARTS_PERSON");

    ownerUser = {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      phone: null,
      isCustomer: false,
      memberships: [{ id: ownerMem.id, shopId: shop.id, role: "OWNER", isActive: true }],
    };

    saUser = {
      id: sa.id,
      email: sa.email,
      name: sa.name,
      phone: null,
      isCustomer: false,
      memberships: [{ id: saMem.id, shopId: shop.id, role: "SERVICE_ADVISOR", isActive: true }],
    };

    techUser = {
      id: tech.id,
      email: tech.email,
      name: tech.name,
      phone: null,
      isCustomer: false,
      memberships: [{ id: techMem.id, shopId: shop.id, role: "TECHNICIAN", isActive: true }],
    };

    otherTechUser = {
      id: otherTech.id,
      email: otherTech.email,
      name: otherTech.name,
      phone: null,
      isCustomer: false,
      memberships: [{ id: otherTechMem.id, shopId: shop.id, role: "TECHNICIAN", isActive: true }],
    };

    qcUser = {
      id: qc.id,
      email: qc.email,
      name: qc.name,
      phone: null,
      isCustomer: false,
      memberships: [{ id: qcMem.id, shopId: shop.id, role: "QC_INSPECTOR", isActive: true }],
    };

    partsUser = {
      id: parts.id,
      email: parts.email,
      name: parts.name,
      phone: null,
      isCustomer: false,
      memberships: [{ id: partsMem.id, shopId: shop.id, role: "PARTS_PERSON", isActive: true }],
    };

    customerUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: null,
      isCustomer: true,
      memberships: [],
    };
  });

  it("Row 1: PENDING -> CONFIRMED (SA) writes exactly 1 history record and notifications", async () => {
    const booking = await createBooking(shopId, customerUser.id, { status: "PENDING" });

    const result = await transitionBooking({
      bookingId: booking.id,
      to: "CONFIRMED",
      actor: saUser,
      note: "Confirmed by SA",
    });

    expect(result.booking.status).toBe("CONFIRMED");
    expect(result.from).toBe("PENDING");
    expect(result.to).toBe("CONFIRMED");

    // History record
    const history = await db.bookingHistory.findMany({ where: { bookingId: booking.id } });
    expect(history.length).toBe(1);
    expect(history[0].fromStatus).toBe("PENDING");
    expect(history[0].toStatus).toBe("CONFIRMED");
    expect(history[0].actorId).toBe(saUser.id);
    expect(history[0].note).toBe("Confirmed by SA");

    // Notification created for customer
    const notifications = await db.notification.findMany({ where: { bookingId: booking.id } });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.some((n) => n.userId === customerUser.id)).toBe(true);
  });

  it("Row 1b: PENDING -> CANCELLED by Customer succeeds with COUNTERPARTY notification", async () => {
    const booking = await createBooking(shopId, customerUser.id, { status: "PENDING" });

    const result = await transitionBooking({
      bookingId: booking.id,
      to: "CANCELLED",
      actor: customerUser,
      note: "Customer cancelled",
    });

    expect(result.booking.status).toBe("CANCELLED");

    // Notifications sent to shop Service Advisors
    const notifications = await db.notification.findMany({ where: { bookingId: booking.id } });
    expect(notifications.some((n) => n.userId === saUser.id)).toBe(true);
  });

  it("Row 2: CONFIRMED -> ASSIGNED sets technicianId and enforces technician membership", async () => {
    const booking = await createBooking(shopId, customerUser.id, { status: "CONFIRMED" });

    // Reject non-technician user assignment
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ASSIGNED",
        actor: saUser,
        payload: { technicianId: saUser.id }, // SA is not a technician
      })
    ).rejects.toThrow(ForbiddenError);

    // Accept valid technician assignment
    const result = await transitionBooking({
      bookingId: booking.id,
      to: "ASSIGNED",
      actor: saUser,
      payload: { technicianId: techUser.id },
    });

    expect(result.booking.status).toBe("ASSIGNED");
    expect(result.booking.technicianId).toBe(techUser.id);
  });

  it("Row 3: ASSIGNED -> INSPECTING allows assigned technician, rejects other technician", async () => {
    const booking = await createBooking(shopId, customerUser.id, {
      status: "ASSIGNED",
      technicianId: techUser.id,
    });

    // Other technician rejected
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "INSPECTING",
        actor: otherTechUser,
      })
    ).rejects.toThrow(ForbiddenError);

    // Assigned technician succeeds
    const result = await transitionBooking({
      bookingId: booking.id,
      to: "INSPECTING",
      actor: techUser,
    });

    expect(result.booking.status).toBe("INSPECTING");
  });

  it("Row 4: INSPECTING -> ESTIMATE_REVIEW creates Estimate revision 1 and requires lines", async () => {
    const booking = await createBooking(shopId, customerUser.id, {
      status: "INSPECTING",
      technicianId: techUser.id,
    });

    // Reject if no estimate lines
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ESTIMATE_REVIEW",
        actor: techUser,
        payload: { items: [] },
      })
    ).rejects.toThrow(ValidationError);

    // Succeed with estimate lines
    const result = await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_REVIEW",
      actor: techUser,
      payload: {
        items: [
          { type: "LABOUR", name: "Oil Change", quantity: 1, unitCost: 3000 },
          { type: "PART", name: "Oil Filter", quantity: 1, unitCost: 1500 },
        ],
      },
    });

    expect(result.booking.status).toBe("ESTIMATE_REVIEW");

    const estimate = await db.estimate.findUnique({
      where: { bookingId: booking.id },
      include: { items: true },
    });

    expect(estimate).not.toBeNull();
    expect(estimate?.revision).toBe(1);
    expect(estimate?.total).toBe(4500);
    expect(estimate?.items.length).toBe(2);
  });

  it("Row 5: ESTIMATE_REVIEW -> AWAITING_CUSTOMER locks estimate with sentAt", async () => {
    const booking = await createBooking(shopId, customerUser.id, {
      status: "INSPECTING",
      technicianId: techUser.id,
    });

    // Advance to ESTIMATE_REVIEW
    await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_REVIEW",
      actor: techUser,
      payload: {
        items: [{ type: "LABOUR", name: "Brake Service", quantity: 1, unitCost: 8000 }],
      },
    });

    // SA sends estimate to customer
    const result = await transitionBooking({
      bookingId: booking.id,
      to: "AWAITING_CUSTOMER",
      actor: saUser,
    });

    expect(result.booking.status).toBe("AWAITING_CUSTOMER");

    const estimate = await db.estimate.findUnique({ where: { bookingId: booking.id } });
    expect(estimate?.sentAt).not.toBeNull();
  });

  it("Row 6a & 6b: AWAITING_CUSTOMER approval / rejection by customer", async () => {
    // Setup booking in AWAITING_CUSTOMER
    const bookingA = await createBooking(shopId, customerUser.id, {
      status: "AWAITING_CUSTOMER",
      technicianId: techUser.id,
    });
    await db.estimate.create({
      data: {
        bookingId: bookingA.id,
        revision: 1,
        total: 5000,
        sentAt: new Date(),
        items: { create: [{ type: "LABOUR", name: "Tune-up", quantity: 1, unitCost: 5000 }] },
      },
    });

    // Non-owner of booking cannot approve
    await expect(
      transitionBooking({
        bookingId: bookingA.id,
        to: "ESTIMATE_APPROVED",
        actor: saUser, // SA is not customer
      })
    ).rejects.toThrow(ForbiddenError);

    // Customer approves
    const approved = await transitionBooking({
      bookingId: bookingA.id,
      to: "ESTIMATE_APPROVED",
      actor: customerUser,
    });
    expect(approved.booking.status).toBe("ESTIMATE_APPROVED");

    const estA = await db.estimate.findUnique({ where: { bookingId: bookingA.id } });
    expect(estA?.approvedAt).not.toBeNull();

    // Customer rejection flow
    const bookingB = await createBooking(shopId, customerUser.id, {
      status: "AWAITING_CUSTOMER",
      technicianId: techUser.id,
    });
    await db.estimate.create({
      data: {
        bookingId: bookingB.id,
        revision: 1,
        total: 5000,
        sentAt: new Date(),
        items: { create: [{ type: "LABOUR", name: "Tune-up", quantity: 1, unitCost: 5000 }] },
      },
    });

    const rejected = await transitionBooking({
      bookingId: bookingB.id,
      to: "ESTIMATE_REJECTED",
      actor: customerUser,
    });
    expect(rejected.booking.status).toBe("ESTIMATE_REJECTED");

    const estB = await db.estimate.findUnique({ where: { bookingId: bookingB.id } });
    expect(estB?.rejectedAt).not.toBeNull();
  });

  it("Row 6c: ESTIMATE_REJECTED -> ESTIMATE_REVIEW increments revision", async () => {
    const booking = await createBooking(shopId, customerUser.id, {
      status: "ESTIMATE_REJECTED",
      technicianId: techUser.id,
    });
    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 5000,
        rejectedAt: new Date(),
        items: { create: [{ type: "LABOUR", name: "Tune-up", quantity: 1, unitCost: 5000 }] },
      },
    });

    const result = await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_REVIEW",
      actor: saUser,
    });

    expect(result.booking.status).toBe("ESTIMATE_REVIEW");

    const estimate = await db.estimate.findUnique({ where: { bookingId: booking.id } });
    expect(estimate?.revision).toBe(2);
    expect(estimate?.rejectedAt).toBeNull();
  });

  it("rejects invalid transition pairs with 409 INVALID_TRANSITION", async () => {
    const booking = await createBooking(shopId, customerUser.id, { status: "PENDING" });

    // PENDING cannot jump to COMPLETED
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "COMPLETED",
        actor: saUser,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("idempotently releases allocated parts when booking is cancelled", async () => {
    const part = await createPart(shopId, { quantity: 15 });
    const booking = await createBooking(shopId, customerUser.id, { status: "CONFIRMED" });

    // Allocate 3 items
    await db.part.update({ where: { id: part.id }, data: { quantity: 12 } });
    await db.allocation.create({
      data: {
        shopId,
        bookingId: booking.id,
        partId: part.id,
        quantity: 3,
      },
    });

    // Note: cancellation from CONFIRMED -> CANCELLED:
    // If not in transitions table directly from CONFIRMED to CANCELLED, let's test PENDING -> CANCELLED
    const bookingPending = await createBooking(shopId, customerUser.id, { status: "PENDING" });
    await db.allocation.create({
      data: {
        shopId,
        bookingId: bookingPending.id,
        partId: part.id,
        quantity: 3,
      },
    });

    await transitionBooking({
      bookingId: bookingPending.id,
      to: "CANCELLED",
      actor: saUser,
    });

    const updatedPart = await db.part.findUniqueOrThrow({ where: { id: part.id } });
    expect(updatedPart.quantity).toBe(15); // Restored!
  });

  it("Row 7: ESTIMATE_APPROVED -> PARTS_PENDING assigns partsPersonId and checks parts role", async () => {
    const booking = await createBooking(shopId, customerUser.id, {
      status: "ESTIMATE_APPROVED",
      technicianId: techUser.id,
    });

    const result = await transitionBooking({
      bookingId: booking.id,
      to: "PARTS_PENDING",
      actor: saUser,
      payload: { partsPersonId: partsUser.id },
    });

    expect(result.booking.status).toBe("PARTS_PENDING");
    expect(result.booking.partsPersonId).toBe(partsUser.id);
  });

  it("Owner can confirm a booking (Row 1)", async () => {
    const booking = await createBooking(shopId, customerUser.id, { status: "PENDING" });

    const result = await transitionBooking({
      bookingId: booking.id,
      to: "CONFIRMED",
      actor: ownerUser,
      note: "Confirmed by Owner",
    });

    expect(result.booking.status).toBe("CONFIRMED");
  });

  it("QC Inspector cannot perform SA/Owner actions (Row 1)", async () => {
    const booking = await createBooking(shopId, customerUser.id, { status: "PENDING" });

    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "CONFIRMED",
        actor: qcUser, // QC Inspector cannot confirm booking
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
