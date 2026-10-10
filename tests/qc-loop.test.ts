import { describe, it, expect } from "vitest";
import {
  createUser,
  createShop,
  createBooking,
  createMembership,
} from "./factories";
import {
  getQcQueue,
  pickQcJob,
  passQcJob,
  failQcJob,
} from "@/lib/services/qc";
import { transitionBooking } from "@/lib/services/booking-state";
import { db } from "@/lib/db";
import {
  ConflictError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
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

describe("Phase 07 — QC Queue and Issue Loop Integration Tests", () => {
  it("Acceptance Check 1: Concurrent pick lock — exactly one inspector succeeds, second gets 409", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const qc1 = await createUser({ name: "QC Inspector 1" });
    const qc1Mem = await createMembership(qc1.id, shop.id, "QC_INSPECTOR");
    const qc1User = toAuthStaff(qc1, qc1Mem);

    const qc2 = await createUser({ name: "QC Inspector 2" });
    const qc2Mem = await createMembership(qc2.id, shop.id, "QC_INSPECTOR");
    const qc2User = toAuthStaff(qc2, qc2Mem);

    const customer = await createUser({ isCustomer: true });
    const tech = await createUser({ name: "Technician Ali" });
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    const booking = await createBooking(shop.id, customer.id, {
      status: "QC_PENDING",
      technicianId: tech.id,
    });

    // Both inspectors attempt to pick the same job simultaneously
    const results = await Promise.allSettled([
      pickQcJob(qc1User, shop.id, booking.id),
      pickQcJob(qc2User, shop.id, booking.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedError).toBeInstanceOf(ConflictError);
    expect(rejectedError.statusCode).toBe(409);

    // Verify DB state
    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("QC_IN_PROGRESS");
    expect([qc1.id, qc2.id]).toContain(updated.qcInspectorId);
  });

  it("Acceptance Check 2: Submit a failed inspection without title or description and confirm it is rejected", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const qc = await createUser({ name: "QC Inspector" });
    const qcMem = await createMembership(qc.id, shop.id, "QC_INSPECTOR");
    const qcUser = toAuthStaff(qc, qcMem);

    const customer = await createUser({ isCustomer: true });
    const tech = await createUser({ name: "Technician" });
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    const booking = await createBooking(shop.id, customer.id, {
      status: "QC_IN_PROGRESS",
      technicianId: tech.id,
      qcInspectorId: qc.id,
    });

    // Missing title
    await expect(
      failQcJob(qcUser, shop.id, booking.id, {
        title: "",
        description: "Brake fluid leaking",
      })
    ).rejects.toThrow(ValidationError);

    // Missing description
    await expect(
      failQcJob(qcUser, shop.id, booking.id, {
        title: "Fluid Leak",
        description: "   ",
      })
    ).rejects.toThrow(ValidationError);

    // Booking remains unchanged
    const unchanged = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(unchanged.status).toBe("QC_IN_PROGRESS");
    expect(unchanged.qcInspectorId).toBe(qc.id);
  });

  it("Acceptance Check 3: Fail a job, return it to the technician for repair, submit for QC again; fails twice and then passes successfully", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const qc1 = await createUser({ name: "QC Inspector 1" });
    const qc1Mem = await createMembership(qc1.id, shop.id, "QC_INSPECTOR");
    const qc1User = toAuthStaff(qc1, qc1Mem);

    const qc2 = await createUser({ name: "QC Inspector 2" });
    const qc2Mem = await createMembership(qc2.id, shop.id, "QC_INSPECTOR");
    const qc2User = toAuthStaff(qc2, qc2Mem);

    const customer = await createUser({ isCustomer: true });
    const tech = await createUser({ name: "Assigned Tech" });
    const techMem = await createMembership(tech.id, shop.id, "TECHNICIAN");
    const techUser = toAuthStaff(tech, techMem);

    const booking = await createBooking(shop.id, customer.id, {
      status: "QC_PENDING",
      technicianId: tech.id,
    });

    // 1. First QC Cycle: Pick and Fail
    await pickQcJob(qc1User, shop.id, booking.id);
    await failQcJob(qc1User, shop.id, booking.id, {
      title: "Issue 1: Loose Caliper Bolts",
      description: "Front right brake caliper bolts torqued below spec.",
    });

    let current = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(current.status).toBe("IN_REPAIR");
    expect(current.qcInspectorId).toBeNull();
    expect(current.technicianId).toBe(tech.id);

    let issues = await db.qcIssue.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe("Issue 1: Loose Caliper Bolts");
    expect(issues[0].raisedById).toBe(qc1.id);

    // 2. Technician fixes and returns job to QC (Row 11: IN_REPAIR -> QC_PENDING)
    await transitionBooking({
      bookingId: booking.id,
      to: "QC_PENDING",
      actor: techUser,
      note: "Torqued caliper bolts to 85 Nm; ready for re-test",
    });

    current = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(current.status).toBe("QC_PENDING");

    // 3. Second QC Cycle: QC2 picks and fails again
    await pickQcJob(qc2User, shop.id, booking.id);
    await failQcJob(qc2User, shop.id, booking.id, {
      title: "Issue 2: Brake Pedal Softness",
      description: "Air remains in the hydraulic brake line.",
    });

    current = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(current.status).toBe("IN_REPAIR");
    expect(current.qcInspectorId).toBeNull();
    expect(current.technicianId).toBe(tech.id);

    issues = await db.qcIssue.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });
    expect(issues).toHaveLength(2);
    expect(issues[1].title).toBe("Issue 2: Brake Pedal Softness");
    expect(issues[1].raisedById).toBe(qc2.id);

    // 4. Technician fixes and re-submits to QC
    await transitionBooking({
      bookingId: booking.id,
      to: "QC_PENDING",
      actor: techUser,
      note: "Full hydraulic bleed completed; pedal firm",
    });

    // 5. Third QC Cycle: QC1 picks and passes
    await pickQcJob(qc1User, shop.id, booking.id);
    await passQcJob(qc1User, shop.id, booking.id, "Brake test passed on rolling road");

    current = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(current.status).toBe("READY_FOR_PICKUP");
    expect(current.qcInspectorId).toBe(qc1.id);

    // Confirm all issue history is preserved
    issues = await db.qcIssue.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });
    expect(issues).toHaveLength(2);
  });

  it("Acceptance Check 4: Confirm only the inspector who picked the job can pass or fail it", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);

    const qc1 = await createUser({ name: "Inspector One" });
    const qc1Mem = await createMembership(qc1.id, shop.id, "QC_INSPECTOR");
    const qc1User = toAuthStaff(qc1, qc1Mem);

    const qc2 = await createUser({ name: "Inspector Two" });
    const qc2Mem = await createMembership(qc2.id, shop.id, "QC_INSPECTOR");
    const qc2User = toAuthStaff(qc2, qc2Mem);

    const customer = await createUser({ isCustomer: true });
    const tech = await createUser({ name: "Tech Tariq" });
    await createMembership(tech.id, shop.id, "TECHNICIAN");

    const booking = await createBooking(shop.id, customer.id, {
      status: "QC_IN_PROGRESS",
      technicianId: tech.id,
      qcInspectorId: qc1.id, // Picked by qc1
    });

    // qc2 tries to pass qc1's job -> forbidden
    await expect(
      passQcJob(qc2User, shop.id, booking.id)
    ).rejects.toThrow(ForbiddenError);

    // qc2 tries to fail qc1's job -> forbidden
    await expect(
      failQcJob(qc2User, shop.id, booking.id, {
        title: "Test Issue",
        description: "Test description",
      })
    ).rejects.toThrow(ForbiddenError);

    // qc1 successfully passes
    const passed = await passQcJob(qc1User, shop.id, booking.id);
    expect(passed.booking.status).toBe("READY_FOR_PICKUP");
  });

  it("Acceptance Check 5: Confirm inspectors cannot access QC jobs belonging to another shop", async () => {
    const owner = await createUser();
    const shopA = await createShop(owner.id, { name: "Shop Alpha" });
    const shopB = await createShop(owner.id, { name: "Shop Beta" });

    const qcA = await createUser({ name: "Inspector Alpha" });
    const qcA_Mem = await createMembership(qcA.id, shopA.id, "QC_INSPECTOR");
    const qcA_User = toAuthStaff(qcA, qcA_Mem);

    const qcB = await createUser({ name: "Inspector Beta" });
    const qcB_Mem = await createMembership(qcB.id, shopB.id, "QC_INSPECTOR");
    const qcB_User = toAuthStaff(qcB, qcB_Mem);

    const customer = await createUser({ isCustomer: true });
    const techA = await createUser({ name: "Tech Alpha" });
    await createMembership(techA.id, shopA.id, "TECHNICIAN");

    const bookingShopA = await createBooking(shopA.id, customer.id, {
      status: "QC_PENDING",
      technicianId: techA.id,
    });

    // Inspector Beta cannot fetch Shop Alpha's QC queue -> Forbidden
    await expect(
      getQcQueue(qcB_User, shopA.id)
    ).rejects.toThrow(ForbiddenError);

    // Inspector Beta cannot pick Shop Alpha's job with Shop Alpha id in path -> Forbidden
    await expect(
      pickQcJob(qcB_User, shopA.id, bookingShopA.id)
    ).rejects.toThrow(ForbiddenError);

    // Inspector Beta cannot pick Shop Alpha's job even under Shop Beta's path -> NotFound
    await expect(
      pickQcJob(qcB_User, shopB.id, bookingShopA.id)
    ).rejects.toThrow(NotFoundError);

    // Inspector Alpha can see booking in Shop Alpha queue
    const queue = await getQcQueue(qcA_User, shopA.id);
    expect(queue.some((item) => item.bookingId === bookingShopA.id)).toBe(true);
  });
});
