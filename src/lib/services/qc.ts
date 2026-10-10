import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { transitionBooking } from "@/lib/services/booking-state";
import type { AuthUser } from "@/lib/auth/types";
import type { QcFailRequest } from "@/lib/contracts/qc";

export async function getQcQueue(actor: AuthUser, shopId: string) {
  // Enforce shop membership and role
  requireRole(actor, shopId, ["QC_INSPECTOR", "OWNER"]);

  const bookings = await db.booking.findMany({
    where: {
      shopId,
      status: "QC_PENDING",
    },
    orderBy: {
      updatedAt: "asc",
    },
    include: {
      vehicle: true,
      technician: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      services: {
        include: {
          service: true,
        },
      },
      estimate: {
        include: {
          items: true,
        },
      },
      qcIssues: {
        include: {
          raisedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return bookings.map((b) => ({
    bookingId: b.id,
    shopId: b.shopId,
    vehicleRegNo: b.vehicle.regNo,
    vehicleModel: `${b.vehicle.make} ${b.vehicle.model}`,
    technicianName: b.technician?.name ?? "Unassigned",
    enteredQcAt: b.updatedAt.toISOString(),
    status: b.status,
    customerNotes: b.customerNotes,
    vehicle: b.vehicle,
    technician: b.technician,
    customer: b.customer,
    services: b.services,
    estimate: b.estimate,
    qcIssues: b.qcIssues,
  }));
}

export async function pickQcJob(
  actor: AuthUser,
  shopId: string,
  bookingId: string
) {
  requireRole(actor, shopId, ["QC_INSPECTOR"]);

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, shopId: true },
  });

  if (!booking || booking.shopId !== shopId) {
    throw new NotFoundError("Booking not found in this shop");
  }

  return transitionBooking({
    bookingId,
    to: "QC_IN_PROGRESS",
    actor,
    note: "Job claimed for quality inspection",
  });
}

export async function passQcJob(
  actor: AuthUser,
  shopId: string,
  bookingId: string,
  note?: string
) {
  requireRole(actor, shopId, ["QC_INSPECTOR"]);

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, shopId: true },
  });

  if (!booking || booking.shopId !== shopId) {
    throw new NotFoundError("Booking not found in this shop");
  }

  return transitionBooking({
    bookingId,
    to: "READY_FOR_PICKUP",
    actor,
    note: note ?? "Quality inspection passed",
  });
}

export async function failQcJob(
  actor: AuthUser,
  shopId: string,
  bookingId: string,
  payload: QcFailRequest & { note?: string }
) {
  requireRole(actor, shopId, ["QC_INSPECTOR"]);

  const title = payload.title?.trim();
  const description = payload.description?.trim();

  if (!title || !description) {
    throw new ValidationError(
      "Issue title and description are required for QC return"
    );
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, shopId: true },
  });

  if (!booking || booking.shopId !== shopId) {
    throw new NotFoundError("Booking not found in this shop");
  }

  return transitionBooking({
    bookingId,
    to: "IN_REPAIR",
    actor,
    note: payload.note ?? `QC Failed: ${title}`,
    payload: {
      title,
      description,
    },
  });
}
