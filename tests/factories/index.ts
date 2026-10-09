import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Role, BookingStatus } from "@/lib/contracts/common";

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).substring(2, 6)}`;
}

export async function createUser(overrides: Partial<{
  name: string;
  email: string;
  password: string;
  isCustomer: boolean;
  isActive: boolean;
}> = {}) {
  const email = overrides.email ?? `${uniqueId("user")}@test.io`;
  const password = overrides.password ?? "password123";
  const passwordHash = await hashPassword(password);

  return db.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email,
      passwordHash,
      isCustomer: overrides.isCustomer ?? false,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createShop(
  ownerId: string,
  overrides: Partial<{
    name: string;
    address: string;
    city: string;
    phone: string;
    workStart: string;
    workEnd: string;
    slotMinutes: number;
    slotCapacity: number;
  }> = {}
) {
  return db.shop.create({
    data: {
      ownerId,
      name: overrides.name ?? `Shop ${uniqueId("name")}`,
      address: overrides.address ?? "123 Auto Lane",
      city: overrides.city ?? "Lahore",
      phone: overrides.phone ?? "+924235800000",
      workStart: overrides.workStart ?? "09:00",
      workEnd: overrides.workEnd ?? "18:00",
      slotMinutes: overrides.slotMinutes ?? 60,
      slotCapacity: overrides.slotCapacity ?? 2,
    },
  });
}

export async function createMembership(
  userId: string,
  shopId: string,
  role: Role,
  overrides: Partial<{ isActive: boolean }> = {}
) {
  return db.membership.create({
    data: {
      userId,
      shopId,
      role,
      isActive: overrides.isActive ?? true,
    },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function createVehicle(
  ownerId: string,
  overrides: Partial<{
    regNo: string;
    make: string;
    model: string;
    year: number;
    color: string;
    mileage: number;
  }> = {}
) {
  counter += 1;
  return db.vehicle.create({
    data: {
      ownerId,
      regNo:
        overrides.regNo ??
        `REG${counter}${Math.random().toString(36).substring(2, 6)}`.toUpperCase(),
      make: overrides.make ?? "Honda",
      model: overrides.model ?? "Civic",
      year: overrides.year ?? 2021,
      color: overrides.color ?? "White",
      mileage: overrides.mileage ?? 35000,
    },
  });
}

export async function createSlot(
  shopId: string,
  overrides: Partial<{
    startsAt: Date;
    capacity: number;
    booked: number;
  }> = {}
) {
  return db.slot.create({
    data: {
      shopId,
      startsAt: overrides.startsAt ?? new Date(Date.now() + 86400000 * Math.random()),
      capacity: overrides.capacity ?? 2,
      booked: overrides.booked ?? 0,
    },
  });
}

export async function createService(
  shopId: string,
  overrides: Partial<{
    name: string;
    estMinutes: number;
    basePrice: number;
  }> = {}
) {
  return db.service.create({
    data: {
      shopId,
      name: overrides.name ?? `Service ${uniqueId("srv")}`,
      estMinutes: overrides.estMinutes ?? 60,
      basePrice: overrides.basePrice ?? 5000,
    },
  });
}

export async function createPart(
  shopId: string,
  overrides: Partial<{
    sku: string;
    name: string;
    quantity: number;
    reorderLevel: number;
    cost: number;
  }> = {}
) {
  return db.part.create({
    data: {
      shopId,
      sku: overrides.sku ?? uniqueId("SKU"),
      name: overrides.name ?? "Brake Pad",
      quantity: overrides.quantity ?? 10,
      reorderLevel: overrides.reorderLevel ?? 2,
      cost: overrides.cost ?? 2500,
    },
  });
}

export async function createBooking(
  shopId: string,
  customerId: string,
  overrides: Partial<{
    vehicleId: string;
    slotId: string;
    status: BookingStatus;
    customerNotes: string;
    technicianId: string;
    partsPersonId: string;
    qcInspectorId: string;
  }> = {}
) {
  let vehicleId = overrides.vehicleId;
  if (!vehicleId) {
    const v = await createVehicle(customerId);
    vehicleId = v.id;
  }

  let slotId = overrides.slotId;
  if (!slotId) {
    const s = await createSlot(shopId);
    slotId = s.id;
  }

  return db.booking.create({
    data: {
      shopId,
      customerId,
      vehicleId,
      slotId,
      status: overrides.status ?? "PENDING",
      customerNotes: overrides.customerNotes,
      technicianId: overrides.technicianId,
      partsPersonId: overrides.partsPersonId,
      qcInspectorId: overrides.qcInspectorId,
    },
    include: {
      vehicle: true,
      customer: true,
      slot: true,
      services: true,
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });
}

export async function createBookingInStatus(
  shopId: string,
  customerId: string,
  status: BookingStatus,
  options: {
    technicianId?: string;
    partsPersonId?: string;
    qcInspectorId?: string;
    createEstimate?: boolean;
    estimateTotal?: number;
  } = {}
) {
  const booking = await createBooking(shopId, customerId, {
    status,
    technicianId: options.technicianId,
    partsPersonId: options.partsPersonId,
    qcInspectorId: options.qcInspectorId,
  });

  if (options.createEstimate || ["ESTIMATE_REVIEW", "AWAITING_CUSTOMER", "ESTIMATE_APPROVED", "ESTIMATE_REJECTED", "PARTS_PENDING", "PARTS_ORDERED", "PARTS_READY", "IN_REPAIR", "QC_PENDING", "QC_IN_PROGRESS", "READY_FOR_PICKUP", "COMPLETED"].includes(status)) {
    await db.estimate.create({
      data: {
        bookingId: booking.id,
        revision: 1,
        total: options.estimateTotal ?? 10000,
        items: {
          create: [
            {
              type: "LABOUR",
              name: "General Inspection & Repair",
              quantity: 1,
              unitCost: 10000,
            },
          ],
        },
      },
    });
  }

  return db.booking.findUniqueOrThrow({
    where: { id: booking.id },
    include: {
      vehicle: true,
      customer: true,
      slot: true,
      services: true,
      estimate: {
        include: {
          items: true,
        },
      },
    },
  });
}
