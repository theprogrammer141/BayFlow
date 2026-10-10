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
} from "@/lib/services/bookings";
import { transitionBooking } from "@/lib/services/booking-state";
import { saveBookingEstimate } from "@/lib/services/estimate";
import { getShopParts } from "@/lib/services/parts";
import { db } from "@/lib/db";
import {
  ForbiddenError,
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

describe("Phase 05 — Technician Dashboard and Estimate Builder Integration Tests", () => {
  it("Acceptance Check 1: Enforces assignment scope and denies cross-technician access", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const tech1 = await createUser({ name: "Tech Tariq" });
    const tech1Mem = await createMembership(tech1.id, shop.id, "TECHNICIAN");

    const tech2 = await createUser({ name: "Tech Zeeshan" });
    const tech2Mem = await createMembership(tech2.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ isCustomer: true, name: "Customer Ali" });

    // Job 1 assigned to tech1
    const job1 = await createBooking(shop.id, customer.id, {
      status: "ASSIGNED",
      technicianId: tech1.id,
      customerNotes: "Front brakes squeaking",
    });

    // Job 2 assigned to tech2
    const job2 = await createBooking(shop.id, customer.id, {
      status: "ASSIGNED",
      technicianId: tech2.id,
      customerNotes: "Engine oil change and filter",
    });

    const authTech1 = toAuthStaff(tech1, tech1Mem);
    const authTech2 = toAuthStaff(tech2, tech2Mem);

    // 1. Tech 1 lists bookings -> only job 1 appears
    const tech1Jobs = await getShopBookings(authTech1, shop.id);
    expect(tech1Jobs.bookings.some((b) => b.id === job1.id)).toBe(true);
    expect(tech1Jobs.bookings.some((b) => b.id === job2.id)).toBe(false);
    expect(tech1Jobs.counts.ALL).toBe(1);
    expect(tech1Jobs.counts.ASSIGNED).toBe(1);

    // 2. Tech 1 can view their assigned job details
    const job1Detail = await getShopBookingById(authTech1, shop.id, job1.id);
    expect(job1Detail.id).toBe(job1.id);
    expect(job1Detail.technicianId).toBe(tech1.id);

    // 3. Tech 1 cannot access Tech 2's booking -> 403 ForbiddenError
    await expect(
      getShopBookingById(authTech1, shop.id, job2.id)
    ).rejects.toThrow(ForbiddenError);

    // Tech 2 can access their own assigned job 2
    const job2Detail = await getShopBookingById(authTech2, shop.id, job2.id);
    expect(job2Detail.id).toBe(job2.id);

    // 4. Cross-shop isolation: Tech 1 cannot query another shop
    const otherShop = await createShop(owner.id, { name: "Other Shop Motors" });
    await expect(
      getShopBookings(authTech1, otherShop.id)
    ).rejects.toThrow(ForbiddenError);
  });

  it("Acceptance Check 2: Starting an assigned job moves it from ASSIGNED to INSPECTING", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const tech = await createUser({ name: "Tech Rashid" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");

    const otherTech = await createUser({ name: "Tech Impostor" });
    const otherTechMem = await createMembership(otherTech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "ASSIGNED",
      technicianId: tech.id,
    });

    const authTech = toAuthStaff(tech, techMem);
    const authOtherTech = toAuthStaff(otherTech, otherTechMem);

    // 1. Another technician cannot start the inspection -> 403
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "INSPECTING",
        actor: authOtherTech,
        note: "Trying to start someone else's job",
      })
    ).rejects.toThrow(ForbiddenError);

    // 2. Assigned technician starts inspection -> ASSIGNED -> INSPECTING
    const result = await transitionBooking({
      bookingId: booking.id,
      to: "INSPECTING",
      actor: authTech,
      note: "Started vehicle diagnostic inspection",
    });

    expect(result.to).toBe("INSPECTING");

    const updated = await db.booking.findUnique({ where: { id: booking.id } });
    expect(updated?.status).toBe("INSPECTING");

    // History record persisted
    const history = await db.bookingHistory.findFirst({
      where: { bookingId: booking.id, toStatus: "INSPECTING" },
    });
    expect(history?.actorId).toBe(tech.id);
  });

  it("Acceptance Check 3 & 4: Estimate builder validates lines, subtotal, and review submission", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const tech = await createUser({ name: "Tech Usman" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "INSPECTING",
      technicianId: tech.id,
    });

    const authTech = toAuthStaff(tech, techMem);

    // Optional catalog part created
    const catalogPart = await createPart(shop.id, {
      name: "Brake Pads Heavy Duty",
      cost: 4500,
    });

    // 1. Submitting with no estimate lines is rejected
    await expect(
      transitionBooking({
        bookingId: booking.id,
        to: "ESTIMATE_REVIEW",
        actor: authTech,
        payload: { items: [] },
      })
    ).rejects.toThrow(ValidationError);

    // 2. Technician builds estimate with catalog part and labour lines
    const estimate = await saveBookingEstimate(authTech, shop.id, booking.id, {
      items: [
        {
          type: "PART",
          name: "Brake Pads Heavy Duty",
          partId: catalogPart.id,
          quantity: 2,
          unitCost: 4500, // 9000
        },
        {
          type: "PART",
          name: "Custom Brake Cleaner Fluid", // Custom text line without partId
          quantity: 1,
          unitCost: 1200, // 1200
        },
        {
          type: "LABOUR",
          name: "Front Brake System Overhaul",
          quantity: 2,
          unitCost: 2500, // 5000
        },
      ],
    });

    // Subtotal server recomputed: 9000 + 1200 + 5000 = 15200 PKR
    expect(estimate.total).toBe(15200);
    expect(estimate.items.length).toBe(3);

    // 3. Submit valid estimate moves to ESTIMATE_REVIEW
    const transitionResult = await transitionBooking({
      bookingId: booking.id,
      to: "ESTIMATE_REVIEW",
      actor: authTech,
      note: "Inspection complete. Estimate prepared for SA review.",
    });

    expect(transitionResult.to).toBe("ESTIMATE_REVIEW");

    const inReview = await db.booking.findUnique({
      where: { id: booking.id },
      include: { estimate: true },
    });
    expect(inReview?.status).toBe("ESTIMATE_REVIEW");
    expect(inReview?.estimate?.revision).toBe(1);
    expect(inReview?.estimate?.total).toBe(15200);
  });

  it("Acceptance Check 5: Returned QC issue appears in IN_REPAIR and technician can send to QC_PENDING", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const tech = await createUser({ name: "Tech Hamza" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");

    const qcInspector = await createUser({ name: "Inspector Bilal" });
    const qcMem = await createMembership(qcInspector.id, shop.id, "QC_INSPECTOR");

    const customer = await createUser({ isCustomer: true });
    const booking = await createBooking(shop.id, customer.id, {
      status: "QC_IN_PROGRESS",
      technicianId: tech.id,
      qcInspectorId: qcInspector.id,
    });

    const authTech = toAuthStaff(tech, techMem);
    const authQc = toAuthStaff(qcInspector, qcMem);

    // 1. QC returns booking with issue -> QC_IN_PROGRESS -> IN_REPAIR
    const returnResult = await transitionBooking({
      bookingId: booking.id,
      to: "IN_REPAIR",
      actor: authQc,
      note: "Failed quality inspection: Brake pedal spongy",
      payload: {
        title: "Brake Hydraulic Air Lock",
        description: "Brake line bleeding required. Brake pedal travel is excessive.",
      },
    });

    expect(returnResult.to).toBe("IN_REPAIR");

    // 2. Assigned technician loads the booking and verifies QC issue details and history
    const techBookingView = await getShopBookingById(authTech, shop.id, booking.id);
    expect(techBookingView.status).toBe("IN_REPAIR");
    expect(techBookingView.qcIssues).toBeDefined();
    expect(techBookingView.qcIssues?.length).toBe(1);
    expect(techBookingView.qcIssues?.[0].title).toBe("Brake Hydraulic Air Lock");
    expect(techBookingView.qcIssues?.[0].description).toContain("bleeding required");
    expect(techBookingView.qcIssues?.[0].raisedBy?.name).toBe("Inspector Bilal");

    // 3. Once repair is complete, assigned technician moves booking to QC_PENDING
    const sendToQcResult = await transitionBooking({
      bookingId: booking.id,
      to: "QC_PENDING",
      actor: authTech,
      note: "Brake system bled and recalibrated. Ready for re-inspection.",
    });

    expect(sendToQcResult.to).toBe("QC_PENDING");

    const finalStatus = await db.booking.findUnique({ where: { id: booking.id } });
    expect(finalStatus?.status).toBe("QC_PENDING");
  });

  it("Acceptance Check 6: Catalog parts query works for part picker integration", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const tech = await createUser({ name: "Tech Part Picker" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");

    const part1 = await createPart(shop.id, { name: "Oil Filter Premium", cost: 1500 });
    const part2 = await createPart(shop.id, { name: "Synthetic Motor Oil 5W-30", cost: 6500 });

    const authTech = toAuthStaff(tech, techMem);

    const parts = await getShopParts(authTech, shop.id);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.some((p) => p.id === part1.id)).toBe(true);
    expect(parts.some((p) => p.id === part2.id)).toBe(true);
  });
});
