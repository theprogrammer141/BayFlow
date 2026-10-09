import { db } from "@/lib/db";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InvalidTransitionError,
} from "@/lib/errors";
import { requireMembership } from "@/lib/tenancy/membership";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signJwt } from "@/lib/auth/jwt";
import { claimSlotCapacity } from "./slots";
import type {
  CreateBookingRequest,
  BookingFilterQuery,
} from "@/lib/contracts/booking";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/lib/auth/types";

export async function createCustomerBooking(data: CreateBookingRequest) {
  return db.$transaction(async (tx) => {
    // 1. Verify shop exists
    const shop = await tx.shop.findUnique({
      where: { id: data.shopId },
      select: { id: true, name: true },
    });

    if (!shop) {
      throw new NotFoundError("Shop not found");
    }

    // 2. Claim slot capacity atomically (fails with ConflictError if booked >= capacity)
    await claimSlotCapacity(tx, data.slotId, data.shopId);

    // 3. Customer account reuse or creation
    const emailNormalized = data.customer.email.toLowerCase().trim();
    const existingCustomer = await tx.user.findUnique({
      where: { email: emailNormalized },
    });

    let customerId: string;
    let customerName: string;
    let customerPhone: string | null = null;

    if (existingCustomer) {
      const isPasswordValid = await verifyPassword(
        data.customer.password,
        existingCustomer.passwordHash
      );
      if (!isPasswordValid) {
        throw new ValidationError(
          "An account with this email already exists with a different password. Please log in first."
        );
      }
      customerId = existingCustomer.id;
      customerName = existingCustomer.name;
      customerPhone = existingCustomer.phone ?? data.customer.phone ?? null;

      // Update phone if newly provided
      if (!existingCustomer.phone && data.customer.phone) {
        await tx.user.update({
          where: { id: customerId },
          data: { phone: data.customer.phone.trim() },
        });
      }
    } else {
      const passwordHash = await hashPassword(data.customer.password);
      const newCustomer = await tx.user.create({
        data: {
          name: data.customer.name.trim(),
          email: emailNormalized,
          phone: data.customer.phone?.trim() ?? null,
          passwordHash,
          isCustomer: true,
          isActive: true,
        },
      });
      customerId = newCustomer.id;
      customerName = newCustomer.name;
      customerPhone = newCustomer.phone;
    }

    // 4. Vehicle creation or reuse for this customer
    const regNoNormalized = data.vehicle.regNo.trim().toUpperCase();
    const existingVehicle = await tx.vehicle.findFirst({
      where: {
        ownerId: customerId,
        regNo: regNoNormalized,
      },
    });

    let vehicleId: string;
    if (existingVehicle) {
      vehicleId = existingVehicle.id;
      // Optionally update vehicle stats
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          make: data.vehicle.make,
          model: data.vehicle.model,
          year: data.vehicle.year,
          color: data.vehicle.color ?? existingVehicle.color,
          mileage: data.vehicle.mileage ?? existingVehicle.mileage,
        },
      });
    } else {
      const createdVehicle = await tx.vehicle.create({
        data: {
          ownerId: customerId,
          regNo: regNoNormalized,
          make: data.vehicle.make.trim(),
          model: data.vehicle.model.trim(),
          year: data.vehicle.year,
          color: data.vehicle.color?.trim() ?? null,
          mileage: data.vehicle.mileage ?? null,
        },
      });
      vehicleId = createdVehicle.id;
    }

    // 5. Verify services belong to this shop
    const services = await tx.service.findMany({
      where: {
        id: { in: data.serviceIds },
        shopId: data.shopId,
      },
    });

    if (services.length !== data.serviceIds.length) {
      throw new ValidationError("One or more selected services are invalid for this shop");
    }

    // 6. Create booking with PENDING status
    const booking = await tx.booking.create({
      data: {
        shopId: data.shopId,
        customerId,
        vehicleId,
        slotId: data.slotId,
        status: "PENDING",
        customerNotes: data.customerNotes?.trim() ?? null,
        services: {
          create: services.map((s) => ({
            serviceId: s.id,
            quantity: 1,
            unitPrice: s.basePrice ?? 0,
          })),
        },
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        vehicle: true,
        slot: true,
        shop: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
          },
        },
      },
    });

    // 7. Write audit history record
    await tx.bookingHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: null,
        toStatus: "PENDING",
        actorId: customerId,
        note: "Appointment booked online by customer",
      },
    });

    // 8. Transactional notification to Shop Service Advisors & Owners
    const saMemberships = await tx.membership.findMany({
      where: {
        shopId: data.shopId,
        role: { in: ["SERVICE_ADVISOR", "OWNER"] },
        isActive: true,
      },
      select: { userId: true },
    });

    if (saMemberships.length > 0) {
      await tx.notification.createMany({
        data: saMemberships.map((m) => ({
          userId: m.userId,
          shopId: data.shopId,
          bookingId: booking.id,
          type: "STATUS_PENDING",
          message: `New booking #${booking.id} created for ${data.vehicle.make} ${data.vehicle.model}`,
        })),
      });
    }

    // 9. Build customer session AuthUser & sign JWT
    const authUser: AuthUser = {
      id: customerId,
      email: emailNormalized,
      name: customerName,
      phone: customerPhone,
      isCustomer: true,
      memberships: [],
    };

    const token = await signJwt({
      userId: authUser.id,
      email: authUser.email,
      isCustomer: true,
    });

    return {
      booking,
      customer: authUser,
      token,
    };
  });
}

export async function getCustomerBookings(customerId: string) {
  return db.booking.findMany({
    where: { customerId },
    include: {
      vehicle: true,
      shop: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          phone: true,
        },
      },
      slot: true,
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
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerBookingById(customerId: string, bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      vehicle: true,
      shop: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          phone: true,
        },
      },
      slot: true,
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
      history: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  if (booking.customerId !== customerId) {
    throw new ForbiddenError("Not authorized to view this booking");
  }

  return booking;
}

export async function getShopBookings(
  actor: AuthUser,
  shopId: string,
  filter?: BookingFilterQuery
) {
  requireMembership(actor, shopId, ["SERVICE_ADVISOR", "OWNER"]);

  // Calculate status counts for the entire shop
  const countsRaw = await db.booking.groupBy({
    by: ["status"],
    where: { shopId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    ALL: 0,
  };

  for (const group of countsRaw) {
    counts[group.status] = group._count._all;
    counts.ALL += group._count._all;
  }

  const where: Prisma.BookingWhereInput = {
    shopId,
    ...(filter?.status ? { status: filter.status } : {}),
  };

  const bookings = await db.booking.findMany({
    where,
    include: {
      vehicle: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      slot: true,
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
      technician: {
        select: { id: true, name: true, email: true },
      },
      partsPerson: {
        select: { id: true, name: true, email: true },
      },
      qcInspector: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    bookings,
    counts,
  };
}

export async function getShopBookingById(
  actor: AuthUser,
  shopId: string,
  bookingId: string
) {
  requireMembership(actor, shopId, ["SERVICE_ADVISOR", "OWNER"]);

  const booking = await db.booking.findFirst({
    where: { id: bookingId, shopId },
    include: {
      vehicle: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      slot: true,
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
      history: {
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      technician: {
        select: { id: true, name: true, email: true, phone: true },
      },
      partsPerson: {
        select: { id: true, name: true, email: true, phone: true },
      },
      qcInspector: {
        select: { id: true, name: true, email: true, phone: true },
      },
      shop: {
        select: { id: true, name: true, city: true, address: true, phone: true },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found in this shop");
  }

  return booking;
}

export async function notifyBookingReady(
  actor: AuthUser,
  shopId: string,
  bookingId: string
) {
  requireMembership(actor, shopId, ["SERVICE_ADVISOR", "OWNER"]);

  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, shopId },
      include: {
        vehicle: true,
        customer: true,
      },
    });

    if (!booking) {
      throw new NotFoundError("Booking not found in this shop");
    }

    if (booking.status !== "READY_FOR_PICKUP") {
      throw new InvalidTransitionError(
        `Cannot notify customer when booking is in ${booking.status} status. Status must be READY_FOR_PICKUP.`
      );
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        readyNotifiedAt: new Date(),
      },
      include: {
        vehicle: true,
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        estimate: true,
      },
    });

    // Create notification in the same transaction
    await tx.notification.create({
      data: {
        userId: booking.customerId,
        shopId: booking.shopId,
        bookingId: booking.id,
        type: "STATUS_READY_FOR_PICKUP",
        message: `Your vehicle (${booking.vehicle.make} ${booking.vehicle.model} - ${booking.vehicle.regNo}) is ready for pickup!`,
      },
    });

    // Create history entry
    await tx.bookingHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: "READY_FOR_PICKUP",
        toStatus: "READY_FOR_PICKUP",
        actorId: actor.id,
        note: "Customer notified vehicle is ready for pickup",
      },
    });

    return updated;
  });
}

