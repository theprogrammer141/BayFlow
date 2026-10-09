import { describe, it, expect } from "vitest";
import {
  createUser,
  createShop,
  createSlot,
  createService,
  createMembership,
} from "./factories";
import {
  createCustomerBooking,
  getCustomerBookings,
  getCustomerBookingById,
} from "@/lib/services/bookings";
import { db } from "@/lib/db";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/errors";

describe("Booking Creation Service & Concurrency", () => {
  it("creates a booking in a single transaction, creates customer, vehicle, history, notifications and auth token", async () => {
    const owner = await createUser({ name: "Booking Test Owner" });
    const sa = await createUser({ name: "Booking Test SA" });
    const shop = await createShop(owner.id, {
      name: "Super Auto Care",
      slotCapacity: 3,
    });
    await createMembership(sa.id, shop.id, "SERVICE_ADVISOR");

    const slot = await createSlot(shop.id, {
      capacity: 3,
      booked: 0,
    });

    const srv1 = await createService(shop.id, {
      name: "Brake Service",
      basePrice: 7500,
    });

    const customerEmail = `newcustomer_${Date.now()}@test.io`;

    const result = await createCustomerBooking({
      shopId: shop.id,
      slotId: slot.id,
      serviceIds: [srv1.id],
      customerNotes: "Vibration when braking at high speed",
      customer: {
        name: "Usman Khan",
        email: customerEmail,
        phone: "+923001112233",
        password: "securepassword123",
      },
      vehicle: {
        regNo: "ICT-22-9901",
        make: "Toyota",
        model: "Yaris",
        year: 2022,
        color: "Silver",
      },
    });

    // 1. Result verification
    expect(result.booking.id).toBeDefined();
    expect(result.booking.status).toBe("PENDING");
    expect(result.customer.email).toBe(customerEmail);
    expect(result.customer.isCustomer).toBe(true);
    expect(typeof result.token).toBe("string");

    // 2. Slot capacity claimed
    const updatedSlot = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(updatedSlot.booked).toBe(1);

    // 3. Vehicle created
    const vehicle = await db.vehicle.findFirst({
      where: { ownerId: result.customer.id, regNo: "ICT-22-9901" },
    });
    expect(vehicle).toBeDefined();
    expect(vehicle?.make).toBe("Toyota");

    // 4. BookingHistory created
    const history = await db.bookingHistory.findMany({
      where: { bookingId: result.booking.id },
    });
    expect(history.length).toBe(1);
    expect(history[0].toStatus).toBe("PENDING");
    expect(history[0].actorId).toBe(result.customer.id);

    // 5. Notifications sent to SA
    const notifications = await db.notification.findMany({
      where: { bookingId: result.booking.id, userId: sa.id },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("STATUS_PENDING");
  });

  it("reuses existing customer account when email and password match without duplicate user", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot1 = await createSlot(shop.id, { capacity: 3, booked: 0 });
    const slot2 = await createSlot(shop.id, { capacity: 3, booked: 0 });
    const service = await createService(shop.id);

    const email = `reuse_${Date.now()}@test.io`;
    const password = "password12345";

    // 1. First booking creates customer
    const res1 = await createCustomerBooking({
      shopId: shop.id,
      slotId: slot1.id,
      serviceIds: [service.id],
      customer: {
        name: "Ali Ahmed",
        email,
        password,
      },
      vehicle: {
        regNo: "LHR-18-1234",
        make: "Honda",
        model: "Civic",
        year: 2018,
      },
    });

    // 2. Second booking reuses customer
    const res2 = await createCustomerBooking({
      shopId: shop.id,
      slotId: slot2.id,
      serviceIds: [service.id],
      customer: {
        name: "Ali Ahmed",
        email,
        password,
      },
      vehicle: {
        regNo: "LHR-20-5678",
        make: "Suzuki",
        model: "Cultus",
        year: 2020,
      },
    });

    expect(res2.customer.id).toBe(res1.customer.id);

    // Verify only 1 User row exists with this email
    const users = await db.user.findMany({ where: { email } });
    expect(users.length).toBe(1);

    // Verify 2 bookings exist for this customer
    const customerBookings = await getCustomerBookings(res1.customer.id);
    expect(customerBookings.length).toBe(2);
  });

  it("rejects booking when email exists but password does not match, leaving no partial records", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot1 = await createSlot(shop.id, { capacity: 2, booked: 0 });
    const slot2 = await createSlot(shop.id, { capacity: 2, booked: 0 });
    const service = await createService(shop.id);

    const email = `mismatch_${Date.now()}@test.io`;
    const correctPassword = "correctpassword123";

    // Create initial booking/customer
    await createCustomerBooking({
      shopId: shop.id,
      slotId: slot1.id,
      serviceIds: [service.id],
      customer: {
        name: "Zainab Bibi",
        email,
        password: correctPassword,
      },
      vehicle: {
        regNo: "ISB-19-9000",
        make: "Kia",
        model: "Sportage",
        year: 2019,
      },
    });

    // Second booking attempt with WRONG password
    const unattemptedRegNo = `FAIL-${Date.now().toString().slice(-4)}`;
    await expect(
      createCustomerBooking({
        shopId: shop.id,
        slotId: slot2.id,
        serviceIds: [service.id],
        customer: {
          name: "Zainab Bibi",
          email,
          password: "wrongpassword!",
        },
        vehicle: {
          regNo: unattemptedRegNo,
          make: "Kia",
          model: "Picanto",
          year: 2020,
        },
      })
    ).rejects.toThrow(ValidationError);

    // Verify slot2 booked count was NOT incremented (rolled back)
    const slot2After = await db.slot.findUniqueOrThrow({ where: { id: slot2.id } });
    expect(slot2After.booked).toBe(0);

    // Verify failed vehicle was NOT created (rolled back)
    const failedVehicle = await db.vehicle.findFirst({ where: { regNo: unattemptedRegNo } });
    expect(failedVehicle).toBeNull();
  });

  it("handles concurrent booking requests for remaining capacity safely", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id, { slotCapacity: 1 });
    const slot = await createSlot(shop.id, { capacity: 1, booked: 0 });
    const service = await createService(shop.id);

    // Two different customers attempting to book the ONLY slot spot at the same time
    const email1 = `concurrent_1_${Date.now()}@test.io`;
    const email2 = `concurrent_2_${Date.now()}@test.io`;

    const req1 = createCustomerBooking({
      shopId: shop.id,
      slotId: slot.id,
      serviceIds: [service.id],
      customer: { name: "Customer 1", email: email1, password: "password123" },
      vehicle: { regNo: "REG-CONC-1", make: "Toyota", model: "Corolla", year: 2020 },
    });

    const req2 = createCustomerBooking({
      shopId: shop.id,
      slotId: slot.id,
      serviceIds: [service.id],
      customer: { name: "Customer 2", email: email2, password: "password123" },
      vehicle: { regNo: "REG-CONC-2", make: "Honda", model: "City", year: 2021 },
    });

    const results = await Promise.allSettled([req1, req2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    }

    const finalSlot = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.booked).toBe(1);
  });

  it("enforces customer booking ownership checks", async () => {
    const owner = await createUser();
    const shop = await createShop(owner.id);
    const slot = await createSlot(shop.id);
    const service = await createService(shop.id);

    const custA = await createCustomerBooking({
      shopId: shop.id,
      slotId: slot.id,
      serviceIds: [service.id],
      customer: { name: "Customer A", email: `custa_${Date.now()}@test.io`, password: "password123" },
      vehicle: { regNo: "REG-A-01", make: "Toyota", model: "Prius", year: 2017 },
    });

    const custB = await createUser({ isCustomer: true });

    // Customer A can view their booking
    const booking = await getCustomerBookingById(custA.customer.id, custA.booking.id);
    expect(booking.id).toBe(custA.booking.id);

    // Customer B cannot view Customer A's booking -> 403 Forbidden
    await expect(
      getCustomerBookingById(custB.id, custA.booking.id)
    ).rejects.toThrow(ForbiddenError);
  });
});
