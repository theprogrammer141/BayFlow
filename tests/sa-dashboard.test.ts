import { describe, it, expect } from "vitest";
import {
  createUser,
  createShop,
  createBooking,
  createMembership,
  createPart,
} from "./factories";
import {
  getShopBookings,
  getShopBookingById,
  notifyBookingReady,
} from "@/lib/services/bookings";
import { transitionBooking } from "@/lib/services/booking-state";
import { saveBookingEstimate } from "@/lib/services/estimate";
import { getTeamMembers } from "@/lib/services/shops";
import { db } from "@/lib/db";
import {
  ForbiddenError,
  InvalidTransitionError,
  ConflictError,
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

describe("Phase 04 — Service Advisor Dashboard Backend & Transitions", () => {
  it("Acceptance Check 1: SA lists and filters bookings with accurate status counts", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser({ name: "Salma Advisor" });
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const customer1 = await createUser({ isCustomer: true, name: "Customer One" });
    const customer2 = await createUser({ isCustomer: true, name: "Customer Two" });

    // Create 2 PENDING, 1 CONFIRMED
    await createBooking(shop.id, customer1.id, { status: "PENDING" });
    await createBooking(shop.id, customer2.id, { status: "PENDING" });
    await createBooking(shop.id, customer1.id, { status: "CONFIRMED" });

    const saActor = toAuthStaff(sa, saMem);

    // All bookings
    const resultAll = await getShopBookings(saActor, shop.id);
    expect(resultAll.bookings.length).toBe(3);
    expect(resultAll.counts.ALL).toBe(3);
    expect(resultAll.counts.PENDING).toBe(2);
    expect(resultAll.counts.CONFIRMED).toBe(1);

    // Filtered by status
    const resultFiltered = await getShopBookings(saActor, shop.id, { status: "PENDING" });
    expect(resultFiltered.bookings.length).toBe(2);
    expect(resultFiltered.counts.ALL).toBe(3); // counts still represent total
    expect(resultFiltered.counts.PENDING).toBe(2);

    // Detail fetch
    const bookingToFetch = resultAll.bookings[0];
    const detail = await getShopBookingById(saActor, shop.id, bookingToFetch.id);
    expect(detail.id).toBe(bookingToFetch.id);
    expect(detail.customer).toBeDefined();
    expect(detail.vehicle).toBeDefined();
    expect(detail.history).toBeDefined();
  });

  it("Acceptance Check 2: Rejects unauthorized and cross-shop access", async () => {
    const owner1 = await createUser();
    const shop1 = await createShop(owner1.id);
    const sa1 = await createUser({ name: "SA Shop 1" });
    await createMembership(sa1.id, shop1.id, "SERVICE_ADVISOR");

    const owner2 = await createUser();
    const shop2 = await createShop(owner2.id);
    const sa2 = await createUser({ name: "SA Shop 2" });
    const sa2Mem = await createMembership(sa2.id, shop2.id, "SERVICE_ADVISOR");

    const customer = await createUser({ isCustomer: true });
    const booking1 = await createBooking(shop1.id, customer.id, { status: "PENDING" });

    const sa2Actor = toAuthStaff(sa2, sa2Mem);

    // SA2 cannot list bookings for Shop 1
    await expect(getShopBookings(sa2Actor, shop1.id)).rejects.toThrow(ForbiddenError);

    // SA2 cannot view booking of Shop 1
    await expect(getShopBookingById(sa2Actor, shop1.id, booking1.id)).rejects.toThrow(ForbiddenError);

    // Customer cannot view shop bookings
    const customerActor: AuthUser = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      isCustomer: true,
      memberships: [],
    };
    await expect(getShopBookings(customerActor, shop1.id)).rejects.toThrow(ForbiddenError);

    // SA2 cannot read Shop 1 team members
    await expect(getTeamMembers(sa2Actor, shop1.id)).rejects.toThrow(ForbiddenError);
  });

  it("Acceptance Check 3: Intake actions from PENDING (confirm, decline, technician assignment)", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser({ name: "SA Tariq" });
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const tech = await createUser({ name: "Tech Zubair" });
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, { status: "PENDING" });

    const saActor = toAuthStaff(sa, saMem);

    // 1. Confirm PENDING -> CONFIRMED
    const confirmRes = await transitionBooking({
      bookingId: booking.id,
      to: "CONFIRMED",
      actor: saActor,
      note: "Appointment verified by SA",
    });
    expect(confirmRes.booking.status).toBe("CONFIRMED");

    // 2. Assign Technician CONFIRMED -> ASSIGNED
    const assignRes = await transitionBooking({
      bookingId: booking.id,
      to: "ASSIGNED",
      actor: saActor,
      payload: { technicianId: tech.id },
      note: "Assigned to primary technician",
    });
    expect(assignRes.booking.status).toBe("ASSIGNED");
    expect(assignRes.booking.technicianId).toBe(tech.id);

    // 3. Decline flow on another booking
    const declineBooking = await createBooking(shop.id, customer.id, { status: "PENDING" });
    const declineRes = await transitionBooking({
      bookingId: declineBooking.id,
      to: "CANCELLED",
      actor: saActor,
      note: "Decline reason: shop fully booked for heavy diagnostics",
    });
    expect(declineRes.booking.status).toBe("CANCELLED");
  });

  it("Rejects cross-shop technician assignment and non-technician roles", async () => {
    const owner1 = await createUser();
    const shop1 = await createShop(owner1.id);
    const sa1 = await createUser();
    const sa1Mem = await createMembership(sa1.id, shop1.id, "SERVICE_ADVISOR");

    const shop2 = await createShop(owner1.id);
    const foreignTech = await createUser();
    await createMembership(foreignTech.id, shop2.id, "TECHNICIAN");

    const partsStaff = await createUser();
    await createMembership(partsStaff.id, shop1.id, "PARTS_PERSON");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop1.id, customer.id, { status: "CONFIRMED" });

    const saActor = toAuthStaff(sa1, sa1Mem);

    // Assigning technician from another shop fails
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ASSIGNED",
        actor: saActor,
        payload: { technicianId: foreignTech.id },
      })
    ).rejects.toThrow(ForbiddenError);

    // Assigning non-technician role fails
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ASSIGNED",
        actor: saActor,
        payload: { technicianId: partsStaff.id },
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("Acceptance Check 4: Estimate editing in ESTIMATE_REVIEW recalculates totals; locks upon sending", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser();
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const tech = await createUser();
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "ESTIMATE_REVIEW",
      technicianId: tech.id,
    });

    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: 5000,
        items: {
          create: [{ type: "LABOUR", name: "Initial Inspection", quantity: 1, unitCost: 5000 }],
        },
      },
    });

    const saActor = toAuthStaff(sa, saMem);

    // Edit estimate lines as SA
    const updatedEst = await saveBookingEstimate(saActor, shop.id, booking.id, {
      items: [
        { type: "PART", name: "Front Brake Pads", quantity: 2, unitCost: 4500 },
        { type: "LABOUR", name: "Brake Pad Replacement", quantity: 1, unitCost: 3500 },
      ],
    });

    expect(updatedEst.total).toBe(12500); // 2*4500 + 3500 = 12500 PKR integer
    expect(updatedEst.revision).toBe(2);

    // Send to customer: locks estimate
    await transitionBooking({
      bookingId: booking.id,
      to: "AWAITING_CUSTOMER",
      actor: saActor,
    });

    const sentEst = await db.estimate.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(sentEst.sentAt).not.toBeNull();

    // Trying to edit locked estimate fails
    await expect(
      saveBookingEstimate(saActor, shop.id, booking.id, {
        items: [{ type: "LABOUR", name: "Extra Labour", quantity: 1, unitCost: 1000 }],
      })
    ).rejects.toThrow(ConflictError);
  });

  it("Acceptance Check 5: Rejected estimate can be revised (incrementing revision) or cancelled", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser();
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const tech = await createUser();
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "ESTIMATE_REJECTED",
      technicianId: tech.id,
    });

    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 2,
        total: 10000,
        sentAt: new Date(),
        rejectedAt: new Date(),
        items: {
          create: [{ type: "LABOUR", name: "Clutch Repair", quantity: 1, unitCost: 10000 }],
        },
      },
    });

    const saActor = toAuthStaff(sa, saMem);

    // SA revises: returns to ESTIMATE_REVIEW and increments revision
    const reviseRes = await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_REVIEW",
      actor: saActor,
      note: "Revised estimate per customer budget constraints",
    });
    expect(reviseRes.booking.status).toBe("ESTIMATE_REVIEW");

    const revisedEst = await db.estimate.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(revisedEst.revision).toBe(3);
    expect(revisedEst.rejectedAt).toBeNull();

    // Or SA cancels rejected estimate on another booking
    const cancelBooking = await createBooking(shop.id, customer.id, {
      status: "ESTIMATE_REJECTED",
      technicianId: tech.id,
    });
    const cancelRes = await transitionBooking({
      bookingId: cancelBooking.id,
      to: "CANCELLED",
      actor: saActor,
      note: "Customer declined repair; booking closed",
    });
    expect(cancelRes.booking.status).toBe("CANCELLED");
  });

  it("Acceptance Check 6 & 7: Parts assignment, Ready notification, and Completion", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser();
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const partsPerson = await createUser({ name: "Pervaiz Parts" });
    await createMembership(partsPerson.id, shop.id, "PARTS_PERSON");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "ESTIMATE_APPROVED",
    });

    const saActor = toAuthStaff(sa, saMem);

    // SA assigns parts person: ESTIMATE_APPROVED -> PARTS_PENDING
    const partsRes = await transitionBooking({
      bookingId: booking.id,
      to: "PARTS_PENDING",
      actor: saActor,
      payload: { partsPersonId: partsPerson.id },
    });
    expect(partsRes.booking.status).toBe("PARTS_PENDING");
    expect(partsRes.booking.partsPersonId).toBe(partsPerson.id);

    // Ready notification on READY_FOR_PICKUP
    const readyBooking = await createBooking(shop.id, customer.id, {
      status: "READY_FOR_PICKUP",
    });

    const notifiedBooking = await notifyBookingReady(saActor, shop.id, readyBooking.id);
    expect(notifiedBooking.readyNotifiedAt).not.toBeNull();

    // Verify customer notification created in DB
    const notif = await db.notification.findFirst({
      where: {
        userId: customer.id,
        bookingId: readyBooking.id,
        type: "STATUS_READY_FOR_PICKUP",
      },
    });
    expect(notif).not.toBeNull();

    // Complete booking: READY_FOR_PICKUP -> COMPLETED
    const completeRes = await transitionBooking({
      bookingId: readyBooking.id,
      to: "COMPLETED",
      actor: saActor,
      note: "Vehicle handed over to customer",
    });
    expect(completeRes.booking.status).toBe("COMPLETED");
    expect(completeRes.booking.completedAt).not.toBeNull();

    // Notifying ready when not in READY_FOR_PICKUP fails
    await expect(notifyBookingReady(saActor, shop.id, completeRes.booking.id)).rejects.toThrow(
      InvalidTransitionError
    );
  });

  it("Acceptance Check 8: Cancellation works before IN_REPAIR and is rejected once IN_REPAIR or later", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const sa = await createUser();
    const saMem = await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const part = await createPart(shop.id, { quantity: 10 });
    const customer = await createUser({ isCustomer: true });

    const saActor = toAuthStaff(sa, saMem);

    // Cancellation from CONFIRMED works
    const bookingConfirmed = await createBooking(shop.id, customer.id, { status: "CONFIRMED" });
    const cancel1 = await transitionBooking({
      bookingId: bookingConfirmed.id,
      to: "CANCELLED",
      actor: saActor,
    });
    expect(cancel1.booking.status).toBe("CANCELLED");

    // Cancellation from PARTS_READY works and releases allocations
    const bookingPartsReady = await createBooking(shop.id, customer.id, { status: "PARTS_READY" });
    await db.part.update({ where: { id: part.id }, data: { quantity: 7 } });
    await db.allocation.create({
      data: {
        shopId: shop.id,
        bookingId: bookingPartsReady.id,
        partId: part.id,
        quantity: 3,
      },
    });

    const cancel2 = await transitionBooking({
      bookingId: bookingPartsReady.id,
      to: "CANCELLED",
      actor: saActor,
    });
    expect(cancel2.booking.status).toBe("CANCELLED");
    const restoredPart = await db.part.findUniqueOrThrow({ where: { id: part.id } });
    expect(restoredPart.quantity).toBe(10); // Restored!

    // Cancellation from IN_REPAIR fails
    const bookingInRepair = await createBooking(shop.id, customer.id, { status: "IN_REPAIR" });
    await expect(
      transitionBooking({
        bookingId: bookingInRepair.id,
        to: "CANCELLED",
        actor: saActor,
      })
    ).rejects.toThrow(InvalidTransitionError);

    // Cancellation from QC_PENDING fails
    const bookingQc = await createBooking(shop.id, customer.id, { status: "QC_PENDING" });
    await expect(
      transitionBooking({
        bookingId: bookingQc.id,
        to: "CANCELLED",
        actor: saActor,
      })
    ).rejects.toThrow(InvalidTransitionError);

    // Cancellation from READY_FOR_PICKUP fails
    const bookingReady = await createBooking(shop.id, customer.id, { status: "READY_FOR_PICKUP" });
    await expect(
      transitionBooking({
        bookingId: bookingReady.id,
        to: "CANCELLED",
        actor: saActor,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });
});
