import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seedCore(prisma: PrismaClient) {
  console.log("🌱 Cleaning up legacy test data...");

  // 1. Delete existing records in foreign-key safe order
  await prisma.qcIssue.deleteMany({});
  await prisma.allocation.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.estimateItem.deleteMany({});
  await prisma.estimate.deleteMany({});
  await prisma.bookingHistory.deleteMany({});
  await prisma.bookingService.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.slot.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.part.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.shop.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🌱 Seeding pristine demo users and shops...");

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 2. Demo Owner
  const owner = await prisma.user.create({
    data: {
      id: "usr_demo_owner",
      name: "Demo Owner",
      email: "owner@bayflow.demo",
      phone: "+923001234567",
      passwordHash: defaultPasswordHash,
      isCustomer: false,
      isActive: true,
    },
  });

  // 3. Demo Staff Members
  const sa = await prisma.user.create({
    data: {
      id: "usr_demo_sa",
      name: "Demo Service Advisor",
      email: "sa@bayflow.demo",
      phone: "+923001111111",
      passwordHash: defaultPasswordHash,
      isCustomer: false,
      isActive: true,
    },
  });

  const tech = await prisma.user.create({
    data: {
      id: "usr_demo_tech",
      name: "Demo Technician",
      email: "tech@bayflow.demo",
      phone: "+923002222222",
      passwordHash: defaultPasswordHash,
      isCustomer: false,
      isActive: true,
    },
  });

  const qc = await prisma.user.create({
    data: {
      id: "usr_demo_qc",
      name: "Demo QC Inspector",
      email: "qc@bayflow.demo",
      phone: "+923003333333",
      passwordHash: defaultPasswordHash,
      isCustomer: false,
      isActive: true,
    },
  });

  const parts = await prisma.user.create({
    data: {
      id: "usr_demo_parts",
      name: "Demo Parts Person",
      email: "parts@bayflow.demo",
      phone: "+923004444444",
      passwordHash: defaultPasswordHash,
      isCustomer: false,
      isActive: true,
    },
  });

  // 4. Demo Customers
  const customer1 = await prisma.user.create({
    data: {
      id: "usr_demo_cust1",
      name: "Demo Customer",
      email: "customer@bayflow.demo",
      phone: "+923009999999",
      passwordHash: defaultPasswordHash,
      isCustomer: true,
      isActive: true,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      id: "usr_demo_cust2",
      name: "Ali Khan",
      email: "ali@bayflow.demo",
      phone: "+923214567890",
      passwordHash: defaultPasswordHash,
      isCustomer: true,
      isActive: true,
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      id: "usr_demo_cust3",
      name: "Usman Tariq",
      email: "usman@bayflow.demo",
      phone: "+923335678901",
      passwordHash: defaultPasswordHash,
      isCustomer: true,
      isActive: true,
    },
  });

  const customer4 = await prisma.user.create({
    data: {
      id: "usr_demo_cust4",
      name: "Zainab Bibi",
      email: "zainab@bayflow.demo",
      phone: "+923456789012",
      passwordHash: defaultPasswordHash,
      isCustomer: true,
      isActive: true,
    },
  });

  // 5. Demo Vehicles
  const vehicle1 = await prisma.vehicle.create({
    data: {
      id: "veh_demo_corolla",
      ownerId: customer1.id,
      regNo: "LEA-2022",
      make: "Toyota",
      model: "Corolla Altis",
      year: 2022,
      color: "Super White",
      mileage: 38500,
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      id: "veh_demo_civic",
      ownerId: customer1.id,
      regNo: "LED-2021",
      make: "Honda",
      model: "Civic Oriel",
      year: 2021,
      color: "Lunar Silver",
      mileage: 46200,
    },
  });

  const vehicle3 = await prisma.vehicle.create({
    data: {
      id: "veh_demo_swift",
      ownerId: customer2.id,
      regNo: "ICT-2023",
      make: "Suzuki",
      model: "Swift GLX",
      year: 2023,
      color: "Phoenix Red",
      mileage: 18400,
    },
  });

  const vehicle4 = await prisma.vehicle.create({
    data: {
      id: "veh_demo_sportage",
      ownerId: customer3.id,
      regNo: "KHI-2022",
      make: "Kia",
      model: "Sportage AWD",
      year: 2022,
      color: "Cherry Black",
      mileage: 52000,
    },
  });

  const vehicle5 = await prisma.vehicle.create({
    data: {
      id: "veh_demo_tucson",
      ownerId: customer4.id,
      regNo: "ISB-2024",
      make: "Hyundai",
      model: "Tucson GLS",
      year: 2024,
      color: "Titan Grey",
      mileage: 12000,
    },
  });

  // 6. 3 Official Demo Shops (AGENTS.md requirement)
  const shop1 = await prisma.shop.create({
    data: {
      id: "shop_demo_001",
      ownerId: owner.id,
      name: "BayFlow Demo Motors",
      address: "100 Auto Boulevard, Gulberg III",
      city: "Lahore",
      phone: "+924235800000",
      workStart: "09:00",
      workEnd: "18:00",
      slotMinutes: 60,
      slotCapacity: 2,
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      id: "shop_demo_002",
      ownerId: owner.id,
      name: "Sea Breeze Auto Care",
      address: "45 Marine Drive, Clifton Block 4",
      city: "Karachi",
      phone: "+922135800000",
      workStart: "09:00",
      workEnd: "18:00",
      slotMinutes: 60,
      slotCapacity: 2,
    },
  });

  const shop3 = await prisma.shop.create({
    data: {
      id: "shop_demo_003",
      ownerId: owner.id,
      name: "Margalla Auto Dynamics",
      address: "12 Blue Area, Sector F-6",
      city: "Islamabad",
      phone: "+92512800000",
      workStart: "09:00",
      workEnd: "18:00",
      slotMinutes: 60,
      slotCapacity: 2,
    },
  });

  // 7. Memberships
  // Owner memberships
  await prisma.membership.createMany({
    data: [
      { userId: owner.id, shopId: shop1.id, role: "OWNER", isActive: true },
      { userId: owner.id, shopId: shop2.id, role: "OWNER", isActive: true },
      { userId: owner.id, shopId: shop3.id, role: "OWNER", isActive: true },
    ],
  });

  // Staff in shop_demo_001
  await prisma.membership.createMany({
    data: [
      { userId: sa.id, shopId: shop1.id, role: "SERVICE_ADVISOR", isActive: true },
      { userId: sa.id, shopId: shop2.id, role: "SERVICE_ADVISOR", isActive: true }, // dual membership for test
      { userId: tech.id, shopId: shop1.id, role: "TECHNICIAN", isActive: true },
      { userId: qc.id, shopId: shop1.id, role: "QC_INSPECTOR", isActive: true },
      { userId: parts.id, shopId: shop1.id, role: "PARTS_PERSON", isActive: true },
    ],
  });

  // 8. Catalog Services
  const srvShop1Periodic = await prisma.service.create({
    data: {
      shopId: shop1.id,
      name: "Periodic Maintenance",
      description: "Full engine fluids inspection, air/oil filter replacement, spark plug clean and diagnostic scan",
      estMinutes: 120,
      basePrice: 12000,
    },
  });

  const srvShop1Brake = await prisma.service.create({
    data: {
      shopId: shop1.id,
      name: "Brake Inspection & Service",
      description: "Ceramic pad measurement, rotor runout check, caliper lubrication, and brake fluid bleed",
      estMinutes: 60,
      basePrice: 4500,
    },
  });

  await prisma.service.create({
    data: {
      shopId: shop1.id,
      name: "Synthetic Oil & Filter Change",
      description: "Full synthetic 5W-30 engine oil replacement with genuine OEM filter",
      estMinutes: 45,
      basePrice: 3500,
    },
  });

  await prisma.service.create({
    data: {
      shopId: shop1.id,
      name: "AC Service & Gas Top-up",
      description: "Evaporator cleaning, cabin filter replacement, refrigerant pressure testing and R134a top-up",
      estMinutes: 60,
      basePrice: 5500,
    },
  });

  const srvShop1Diag = await prisma.service.create({
    data: {
      shopId: shop1.id,
      name: "Engine Diagnostics & ECU Scan",
      description: "OBD-II live telemetry scan, clear trouble codes, sensor calibration",
      estMinutes: 45,
      basePrice: 4000,
    },
  });

  // Shop 2 Services
  await prisma.service.createMany({
    data: [
      {
        shopId: shop2.id,
        name: "Synthetic Oil & Filter Service",
        description: "High-grade engine oil and OEM filter replacement",
        estMinutes: 45,
        basePrice: 5000,
      },
      {
        shopId: shop2.id,
        name: "Brake Pad Replacement",
        description: "Front & rear ceramic pads replacement",
        estMinutes: 60,
        basePrice: 4500,
      },
      {
        shopId: shop2.id,
        name: "AC Maintenance & Gas Charge",
        description: "Compressor oil check & refrigerant vacuum fill",
        estMinutes: 60,
        basePrice: 6000,
      },
      {
        shopId: shop2.id,
        name: "Complete Auto Detailing",
        description: "Deep interior steam clean, exterior 3-stage compound and ceramic seal",
        estMinutes: 180,
        basePrice: 15000,
      },
    ],
  });

  // Shop 3 Services
  await prisma.service.createMany({
    data: [
      {
        shopId: shop3.id,
        name: "Computerized Wheel Alignment",
        description: "3D camera-based 4-wheel toe, camber, and caster adjustment",
        estMinutes: 45,
        basePrice: 3000,
      },
      {
        shopId: shop3.id,
        name: "Engine Tune-Up & Diagnostics",
        description: "Complete ignition and fuel system overhaul",
        estMinutes: 90,
        basePrice: 8500,
      },
      {
        shopId: shop3.id,
        name: "Brake & Suspension Overhaul",
        description: "Bushings, tie rods, ball joints, and shock absorber inspection",
        estMinutes: 120,
        basePrice: 14000,
      },
    ],
  });

  // 9. Inventory Parts for shop_demo_001
  const partBrakePads = await prisma.part.create({
    data: {
      shopId: shop1.id,
      sku: "BP-FRONT-CERAMIC",
      name: "Front Ceramic Brake Pads (OEM)",
      quantity: 35,
      reorderLevel: 5,
      cost: 3500,
    },
  });

  const partOil = await prisma.part.create({
    data: {
      shopId: shop1.id,
      sku: "OIL-5W30-SYN",
      name: "Synthetic Motor Oil 5W-30 4L",
      quantity: 50,
      reorderLevel: 10,
      cost: 4800,
    },
  });

  const partFilter = await prisma.part.create({
    data: {
      shopId: shop1.id,
      sku: "FLT-OIL-GEN",
      name: "OEM Engine Oil Filter",
      quantity: 45,
      reorderLevel: 10,
      cost: 1200,
    },
  });

  // 10. Available Slots (today and upcoming 7 days)
  console.log("🌱 Materializing slots for scheduling...");
  const slotHours = [9, 10, 11, 12, 14, 15, 16, 17];
  const createdSlotsShop1: Array<{ id: string; startsAt: Date }> = [];

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + dayOffset);
    baseDate.setMinutes(0, 0, 0);

    for (const h of slotHours) {
      const slotTime = new Date(baseDate);
      slotTime.setHours(h, 0, 0, 0);

      const s1 = await prisma.slot.create({
        data: {
          shopId: shop1.id,
          startsAt: slotTime,
          capacity: 2,
          booked: 0,
        },
      });
      createdSlotsShop1.push(s1);

      // Also create slots for shop 2 and shop 3
      await prisma.slot.create({
        data: {
          shopId: shop2.id,
          startsAt: slotTime,
          capacity: 2,
          booked: 0,
        },
      });

      await prisma.slot.create({
        data: {
          shopId: shop3.id,
          startsAt: slotTime,
          capacity: 2,
          booked: 0,
        },
      });
    }
  }

  // 11. Pre-seeded Bookings in shop_demo_001 across key statuses
  console.log("🌱 Creating demo bookings for SA dashboard...");

  // Booking 1: PENDING (Ali Khan / Swift)
  const slotPending = createdSlotsShop1[0];
  await prisma.slot.update({ where: { id: slotPending.id }, data: { booked: { increment: 1 } } });
  const bPending = await prisma.booking.create({
    data: {
      id: "book_demo_pending",
      shopId: shop1.id,
      customerId: customer2.id,
      vehicleId: vehicle3.id,
      slotId: slotPending.id,
      status: "PENDING",
      customerNotes: "Brakes feel slightly spongy, please check brake pads and fluid.",
    },
  });
  await prisma.bookingService.create({
    data: {
      bookingId: bPending.id,
      serviceId: srvShop1Brake.id,
      quantity: 1,
      unitPrice: 4500,
    },
  });
  await prisma.bookingHistory.create({
    data: {
      bookingId: bPending.id,
      fromStatus: null,
      toStatus: "PENDING",
      actorId: customer2.id,
      note: "Customer booked appointment via web wizard",
    },
  });

  // Booking 2: CONFIRMED (Usman Tariq / Sportage)
  const slotConfirmed = createdSlotsShop1[1];
  await prisma.slot.update({ where: { id: slotConfirmed.id }, data: { booked: { increment: 1 } } });
  const bConfirmed = await prisma.booking.create({
    data: {
      id: "book_demo_confirmed",
      shopId: shop1.id,
      customerId: customer3.id,
      vehicleId: vehicle4.id,
      slotId: slotConfirmed.id,
      status: "CONFIRMED",
      customerNotes: "Engine warning light illuminated on dashboard.",
    },
  });
  await prisma.bookingService.create({
    data: {
      bookingId: bConfirmed.id,
      serviceId: srvShop1Diag.id,
      quantity: 1,
      unitPrice: 4000,
    },
  });
  await prisma.bookingHistory.createMany({
    data: [
      {
        bookingId: bConfirmed.id,
        fromStatus: null,
        toStatus: "PENDING",
        actorId: customer3.id,
        note: "Initial booking intake",
      },
      {
        bookingId: bConfirmed.id,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        actorId: sa.id,
        note: "Booking confirmed by Service Advisor",
      },
    ],
  });

  // Booking 3: ASSIGNED (Demo Customer / Corolla)
  const slotAssigned = createdSlotsShop1[2];
  await prisma.slot.update({ where: { id: slotAssigned.id }, data: { booked: { increment: 1 } } });
  const bAssigned = await prisma.booking.create({
    data: {
      id: "book_demo_assigned",
      shopId: shop1.id,
      customerId: customer1.id,
      vehicleId: vehicle1.id,
      slotId: slotAssigned.id,
      status: "ASSIGNED",
      technicianId: tech.id,
      customerNotes: "Regular 40,000 km maintenance.",
    },
  });
  await prisma.bookingService.create({
    data: {
      bookingId: bAssigned.id,
      serviceId: srvShop1Periodic.id,
      quantity: 1,
      unitPrice: 12000,
    },
  });
  await prisma.bookingHistory.createMany({
    data: [
      {
        bookingId: bAssigned.id,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        actorId: sa.id,
        note: "Confirmed",
      },
      {
        bookingId: bAssigned.id,
        fromStatus: "CONFIRMED",
        toStatus: "ASSIGNED",
        actorId: sa.id,
        note: "Assigned to Demo Technician",
      },
    ],
  });

  // Booking 4: ESTIMATE_REVIEW (Zainab Bibi / Tucson)
  const slotReview = createdSlotsShop1[3];
  await prisma.slot.update({ where: { id: slotReview.id }, data: { booked: { increment: 1 } } });
  const bReview = await prisma.booking.create({
    data: {
      id: "book_demo_est_review",
      shopId: shop1.id,
      customerId: customer4.id,
      vehicleId: vehicle5.id,
      slotId: slotReview.id,
      status: "ESTIMATE_REVIEW",
      technicianId: tech.id,
      customerNotes: "Inspection completed, estimate prepared by technician.",
    },
  });
  const estReview = await prisma.estimate.create({
    data: {
      bookingId: bReview.id,
      revision: 1,
      total: 9000,
      sentAt: null,
    },
  });
  await prisma.estimateItem.createMany({
    data: [
      {
        estimateId: estReview.id,
        type: "PART",
        partId: partBrakePads.id,
        name: "Front Ceramic Brake Pads",
        quantity: 2,
        unitCost: 3500,
      },
      {
        estimateId: estReview.id,
        type: "LABOUR",
        name: "Brake Caliper Servicing Labour",
        quantity: 1,
        unitCost: 2000,
      },
    ],
  });

  // Booking 5: AWAITING_CUSTOMER (Demo Customer / Civic)
  const slotAwaiting = createdSlotsShop1[4];
  await prisma.slot.update({ where: { id: slotAwaiting.id }, data: { booked: { increment: 1 } } });
  const bAwaiting = await prisma.booking.create({
    data: {
      id: "book_demo_awaiting",
      shopId: shop1.id,
      customerId: customer1.id,
      vehicleId: vehicle2.id,
      slotId: slotAwaiting.id,
      status: "AWAITING_CUSTOMER",
      technicianId: tech.id,
      customerNotes: "Oil change and full synthetic fluid upgrade.",
    },
  });
  const estAwaiting = await prisma.estimate.create({
    data: {
      bookingId: bAwaiting.id,
      revision: 1,
      total: 8000,
      sentAt: new Date(),
    },
  });
  await prisma.estimateItem.createMany({
    data: [
      {
        estimateId: estAwaiting.id,
        type: "PART",
        partId: partOil.id,
        name: "Synthetic Motor Oil 5W-30 4L",
        quantity: 1,
        unitCost: 4800,
      },
      {
        estimateId: estAwaiting.id,
        type: "PART",
        partId: partFilter.id,
        name: "OEM Engine Oil Filter",
        quantity: 1,
        unitCost: 1200,
      },
      {
        estimateId: estAwaiting.id,
        type: "LABOUR",
        name: "Oil Replacement & Chassis Lube",
        quantity: 1,
        unitCost: 2000,
      },
    ],
  });

  // Booking 6: ESTIMATE_REJECTED (Ali Khan / Swift)
  const slotRejected = createdSlotsShop1[5];
  await prisma.slot.update({ where: { id: slotRejected.id }, data: { booked: { increment: 1 } } });
  const bRejected = await prisma.booking.create({
    data: {
      id: "book_demo_est_rejected",
      shopId: shop1.id,
      customerId: customer2.id,
      vehicleId: vehicle3.id,
      slotId: slotRejected.id,
      status: "ESTIMATE_REJECTED",
      technicianId: tech.id,
      customerNotes: "Customer declined high quotation.",
    },
  });
  await prisma.estimate.create({
    data: {
      bookingId: bRejected.id,
      revision: 1,
      total: 22000,
      sentAt: new Date(Date.now() - 3600000),
      rejectedAt: new Date(),
    },
  });

  // Booking 7: PARTS_PENDING (Usman Tariq / Sportage)
  const slotParts = createdSlotsShop1[6];
  await prisma.slot.update({ where: { id: slotParts.id }, data: { booked: { increment: 1 } } });
  await prisma.booking.create({
    data: {
      id: "book_demo_parts_pending",
      shopId: shop1.id,
      customerId: customer3.id,
      vehicleId: vehicle4.id,
      slotId: slotParts.id,
      status: "PARTS_PENDING",
      technicianId: tech.id,
      customerNotes: "Approved estimate, awaiting parts clerk dispatch.",
    },
  });

  // Booking 8: READY_FOR_PICKUP (Demo Customer / Corolla)
  const slotReady = createdSlotsShop1[7];
  await prisma.slot.update({ where: { id: slotReady.id }, data: { booked: { increment: 1 } } });
  await prisma.booking.create({
    data: {
      id: "book_demo_ready",
      shopId: shop1.id,
      customerId: customer1.id,
      vehicleId: vehicle1.id,
      slotId: slotReady.id,
      status: "READY_FOR_PICKUP",
      technicianId: tech.id,
      readyNotifiedAt: null, // Ready for SA to click Notify Ready!
      customerNotes: "All repairs complete, ready for customer handover.",
    },
  });

  // Booking 9: COMPLETED (Zainab Bibi / Tucson)
  const slotComp = createdSlotsShop1[8];
  await prisma.slot.update({ where: { id: slotComp.id }, data: { booked: { increment: 1 } } });
  await prisma.booking.create({
    data: {
      id: "book_demo_completed",
      shopId: shop1.id,
      customerId: customer4.id,
      vehicleId: vehicle5.id,
      slotId: slotComp.id,
      status: "COMPLETED",
      technicianId: tech.id,
      completedAt: new Date(),
      customerNotes: "Completed vehicle service, customer satisfied.",
    },
  });

  console.log("✅ Core database seed completed with 3 official shops and rich SA demo bookings!");
}
