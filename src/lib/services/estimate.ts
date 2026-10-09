import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/types";
import type { SaveEstimateRequest } from "@/lib/contracts/estimate";

export async function getBookingEstimate(
  actor: AuthUser,
  shopId: string,
  bookingId: string
) {
  const booking = await db.booking.findFirst({
    where: {
      id: bookingId,
      shopId,
    },
    include: {
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found in this shop");
  }

  // Authorization: customer of booking, or staff with active membership in this shop
  const isCustomer = booking.customerId === actor.id;
  const isShopStaff = actor.memberships.some(
    (m) => m.shopId === shopId && m.isActive
  );

  // Shop owner check if not in memberships directly
  const isShopOwner =
    isShopStaff ||
    (await db.shop.findFirst({
      where: { id: shopId, ownerId: actor.id },
    })) !== null;

  if (!isCustomer && !isShopStaff && !isShopOwner) {
    throw new ForbiddenError("Not authorized to view this estimate");
  }

  if (!booking.estimate) {
    throw new NotFoundError("Estimate not found for this booking");
  }

  return booking.estimate;
}

export async function saveBookingEstimate(
  actor: AuthUser,
  shopId: string,
  bookingId: string,
  data: SaveEstimateRequest
) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        id: bookingId,
        shopId,
      },
      include: {
        estimate: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError("Booking not found in this shop");
    }

    const membership = actor.memberships.find(
      (m) => m.shopId === shopId && m.isActive
    );

    const isShopOwner =
      membership?.role === "OWNER" ||
      (await tx.shop.findFirst({
        where: { id: shopId, ownerId: actor.id },
      })) !== null;

    let isSaOrOwnerEdit = false;

    // Role & status validation
    if (booking.status === "INSPECTING") {
      // Assigned technician only
      if (booking.technicianId !== actor.id) {
        throw new ForbiddenError(
          "Only the assigned technician can edit estimates during inspection"
        );
      }
    } else if (booking.status === "ESTIMATE_REVIEW") {
      // SA or Owner only
      const isSa = membership?.role === "SERVICE_ADVISOR";
      if (!isSa && !isShopOwner) {
        throw new ForbiddenError(
          "Only Service Advisors or Shop Owners can edit estimates during review"
        );
      }
      isSaOrOwnerEdit = true;
    } else {
      // If estimate has already been sent to customer (e.g. AWAITING_CUSTOMER), it is locked!
      if (booking.estimate?.sentAt) {
        throw new ConflictError(
          "Sent estimates are locked and cannot be modified until rejected and revised"
        );
      }
      throw new ConflictError(
        `Estimates cannot be edited while booking is in ${booking.status} status`
      );
    }

    // Server-side calculation of estimate total in integer PKR
    const computedTotal = data.items.reduce(
      (acc, item) => acc + item.quantity * item.unitCost,
      0
    );

    if (booking.estimate) {
      // Delete existing items
      await tx.estimateItem.deleteMany({
        where: { estimateId: booking.estimate.id },
      });

      // Update estimate: bump revision if SA/Owner edit
      const updated = await tx.estimate.update({
        where: { id: booking.estimate.id },
        data: {
          total: computedTotal,
          revision: isSaOrOwnerEdit
            ? booking.estimate.revision + 1
            : booking.estimate.revision,
          sentAt: null, // Clear sentAt if modifying draft before sending
          items: {
            create: data.items.map((item) => ({
              type: item.type,
              name: item.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              partId: item.partId ?? null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return updated;
    } else {
      // Create new estimate (revision 1)
      const created = await tx.estimate.create({
        data: {
          bookingId,
          revision: 1,
          total: computedTotal,
          items: {
            create: data.items.map((item) => ({
              type: item.type,
              name: item.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              partId: item.partId ?? null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return created;
    }
  });
}
