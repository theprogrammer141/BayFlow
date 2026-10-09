import { db } from "@/lib/db";
import { findTransition } from "@/lib/state/transitions";
import { getEffect } from "@/lib/state/effects";
import { createNotifications } from "@/lib/services/notifications";
import {
  InvalidTransitionError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/errors";
import type { BookingStatus, ActorRole } from "@/lib/contracts/common";
import type { AuthUser } from "@/lib/auth/types";
import type { Booking, BookingHistory } from "@/generated/prisma/client";
import "@/lib/state/effects";
import "@/lib/state/effects/parts";

export interface TransitionBookingParams {
  bookingId: string;
  to: BookingStatus;
  actor: AuthUser;
  note?: string;
  payload?: Record<string, unknown>;
}

export interface TransitionBookingResult {
  booking: Booking;
  history: BookingHistory;
  from: BookingStatus;
  to: BookingStatus;
}

export async function transitionBooking({
  bookingId,
  to,
  actor,
  note,
  payload,
}: TransitionBookingParams): Promise<TransitionBookingResult> {
  return db.$transaction((tx) =>
    transitionBookingInTransaction(tx, { bookingId, to, actor, note, payload })
  );
}

export async function transitionBookingInTransaction(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  {
    bookingId,
    to,
    actor,
    note,
    payload,
  }: TransitionBookingParams
): Promise<TransitionBookingResult> {
    // 1. Load booking with related records needed for guards and effects
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        estimate: {
          include: {
            items: true,
          },
        },
        services: true,
        allocations: true,
      },
    });

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    const from = booking.status;

    // 2. Validate transition exists in transitions table
    const transition = findTransition(from, to);
    if (!transition) {
      throw new InvalidTransitionError(
        `Invalid transition from ${from} to ${to}`
      );
    }

    // 3. Resolve actor role and validate role permission
    const isBookingCustomer = booking.customerId === actor.id;
    const shopMembership = actor.memberships.find(
      (m) => m.shopId === booking.shopId && m.isActive
    );

    let effectiveRole: ActorRole | null = null;
    if (isBookingCustomer) {
      effectiveRole = "CUSTOMER";
    } else if (shopMembership) {
      effectiveRole = shopMembership.role;
    }

    if (!effectiveRole) {
      throw new ForbiddenError("Not authorized for this shop or booking");
    }

    const rolePermitted =
      transition.roles.includes(effectiveRole) ||
      (effectiveRole === "OWNER" && transition.roles.includes("OWNER"));

    if (!rolePermitted) {
      throw new ForbiddenError(
        `Role ${effectiveRole} is not permitted to transition from ${from} to ${to}. Allowed: ${transition.roles.join(", ")}`
      );
    }

    // 4. Validate extra guards
    if (transition.guardKey) {
      switch (transition.guardKey) {
        case "TARGET_HAS_TECHNICIAN_MEMBERSHIP": {
          const technicianId = payload?.technicianId as string | undefined;
          if (!technicianId) {
            throw new ValidationError("technicianId is required");
          }
          const techMem = await tx.membership.findFirst({
            where: {
              userId: technicianId,
              shopId: booking.shopId,
              role: "TECHNICIAN",
              isActive: true,
            },
          });
          if (!techMem) {
            throw new ForbiddenError(
              "Target user does not have active TECHNICIAN membership in this shop"
            );
          }
          break;
        }

        case "ASSIGNED_TECHNICIAN_ONLY": {
          if (booking.technicianId !== actor.id) {
            throw new ForbiddenError(
              "Action permitted only for the assigned technician"
            );
          }
          break;
        }

        case "ASSIGNED_TECHNICIAN_AND_MIN_ONE_ESTIMATE_LINE": {
          if (booking.technicianId !== actor.id) {
            throw new ForbiddenError(
              "Action permitted only for the assigned technician"
            );
          }
          const hasPayloadItems =
            Array.isArray(payload?.items) && (payload.items as unknown[]).length > 0;
          const hasExistingItems =
            booking.estimate && booking.estimate.items.length > 0;
          if (!hasPayloadItems && !hasExistingItems) {
            throw new ValidationError(
              "Estimate must contain at least one line item"
            );
          }
          break;
        }

        case "ESTIMATE_HAS_LINES_TOTAL_RECOMPUTED": {
          if (!booking.estimate || booking.estimate.items.length === 0) {
            throw new ValidationError(
              "Estimate must contain at least one line item"
            );
          }
          break;
        }

        case "BOOKING_CUSTOMER_ONLY": {
          if (booking.customerId !== actor.id) {
            throw new ForbiddenError(
              "Action permitted only for the booking customer"
            );
          }
          break;
        }

        case "TARGET_HAS_PARTS_MEMBERSHIP": {
          const partsPersonId = payload?.partsPersonId as string | undefined;
          if (partsPersonId) {
            const partsMem = await tx.membership.findFirst({
              where: {
                userId: partsPersonId,
                shopId: booking.shopId,
                role: "PARTS_PERSON",
                isActive: true,
              },
            });
            if (!partsMem) {
              throw new ForbiddenError(
                "Target user does not have active PARTS_PERSON membership in this shop"
              );
            }
          }
          break;
        }

        case "HAS_PARTS_SHORTAGE_AND_PO_CREATED":
        case "EVERY_REQUIRED_PART_IN_STOCK":
        case "ALL_PO_ITEMS_FULLY_RECEIVED":
        case "STOCK_SUFFICIENT":
          break;
      }
    }

    // 5. Apply registered transition effect
    if (from === "PARTS_READY" && to === "IN_REPAIR") {
      const claimed = await tx.booking.updateMany({
        where: { id: booking.id, status: "PARTS_READY" },
        data: { status: to },
      });
      if (claimed.count !== 1) {
        throw new ConflictError("Booking is no longer ready for parts allocation");
      }
    }

    const effectKey = `${from}->${to}`;
    const effect = getEffect(effectKey);
    if (effect) {
      await effect(tx, {
        booking,
        actor,
        note,
        payload,
      });
    }

    // 6. Update booking status
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: to,
        ...(to === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });

    // 7. Write audit history record
    const history = await tx.bookingHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: from,
        toStatus: to,
        actorId: actor.id,
        note: note ?? null,
      },
    });

    // 8. Create transactional notifications
    await createNotifications(tx, {
      booking: updatedBooking,
      transition,
      actor,
    });

  return {
    booking: updatedBooking,
    history,
    from,
    to,
  };
}
