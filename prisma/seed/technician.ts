import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seedTechnician(prisma: PrismaClient) {
  console.log("🌱 Seeding technician dashboard scenario data...");

  const shop = await prisma.shop.findUnique({
    where: { id: "shop_demo_001" },
  });

  if (!shop) {
    console.warn("⚠️ Demo shop not found. Please run core seed first.");
    return;
  }

  const tech = await prisma.user.findUnique({
    where: { email: "tech@bayflow.demo" },
  });
  const qc = await prisma.user.findUnique({
    where: { email: "qc@bayflow.demo" },
  });
  const sa = await prisma.user.findUnique({
    where: { email: "sa@bayflow.demo" },
  });
  const customer = await prisma.user.findUnique({
    where: { email: "customer@bayflow.demo" },
  });

  if (!tech || !qc || !sa || !customer) {
    console.warn("⚠️ Missing required seed users for technician seed.");
    return;
  }

  // 1. Seed sample catalog parts for parts picker
  const partsData = [
    { sku: "BRK-PAD-001", name: "Ceramic Brake Pads (Front)", cost: 4500, quantity: 18, reorderLevel: 4 },
    { sku: "BRK-ROT-002", name: "Ventilated Brake Rotor Disc", cost: 8500, quantity: 8, reorderLevel: 2 },
    { sku: "OIL-FLT-003", name: "Premium Synthetic Oil Filter", cost: 1400, quantity: 25, reorderLevel: 5 },
    { sku: "SPK-PLG-004", name: "Iridium Spark Plugs (Pack of 4)", cost: 5800, quantity: 12, reorderLevel: 3 },
    { sku: "AIR-FLT-005", name: "High-Flow Engine Air Filter", cost: 2200, quantity: 15, reorderLevel: 4 },
  ];

  for (const part of partsData) {
    await prisma.part.upsert({
      where: {
        shopId_sku: {
          shopId: shop.id,
          sku: part.sku,
        },
      },
      update: {
        name: part.name,
        cost: part.cost,
        quantity: part.quantity,
      },
      create: {
        shopId: shop.id,
        sku: part.sku,
        name: part.name,
        cost: part.cost,
        quantity: part.quantity,
        reorderLevel: part.reorderLevel,
      },
    });
  }

  // 2. Seed demo vehicles for customer
  const vehicle1 = await prisma.vehicle.upsert({
    where: { id: "veh_demo_civic_001" },
    update: {},
    create: {
      id: "veh_demo_civic_001",
      ownerId: customer.id,
      regNo: "LES-21-4821",
      make: "Honda",
      model: "Civic Oriel Turbo",
      year: 2021,
      color: "Taffeta White",
      mileage: 38400,
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { id: "veh_demo_corolla_002" },
    update: {},
    create: {
      id: "veh_demo_corolla_002",
      ownerId: customer.id,
      regNo: "LEB-20-9182",
      make: "Toyota",
      model: "Corolla Altis Grande",
      year: 2020,
      color: "Silver Metallic",
      mileage: 52100,
    },
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { id: "veh_demo_sportage_003" },
    update: {},
    create: {
      id: "veh_demo_sportage_003",
      ownerId: customer.id,
      regNo: "ICT-22-3104",
      make: "Kia",
      model: "Sportage AWD",
      year: 2022,
      color: "Panthera Metal",
      mileage: 26800,
    },
  });

  // 3. Seed slots
  const slotDate1 = new Date();
  slotDate1.setHours(9, 0, 0, 0);

  const slotDate2 = new Date();
  slotDate2.setHours(11, 0, 0, 0);

  const slotDate3 = new Date();
  slotDate3.setHours(14, 0, 0, 0);

  const slot1 = await prisma.slot.upsert({
    where: {
      shopId_startsAt: {
        shopId: shop.id,
        startsAt: slotDate1,
      },
    },
    update: {},
    create: {
      shopId: shop.id,
      startsAt: slotDate1,
      capacity: 2,
      booked: 1,
    },
  });

  const slot2 = await prisma.slot.upsert({
    where: {
      shopId_startsAt: {
        shopId: shop.id,
        startsAt: slotDate2,
      },
    },
    update: {},
    create: {
      shopId: shop.id,
      startsAt: slotDate2,
      capacity: 2,
      booked: 1,
    },
  });

  const slot3 = await prisma.slot.upsert({
    where: {
      shopId_startsAt: {
        shopId: shop.id,
        startsAt: slotDate3,
      },
    },
    update: {},
    create: {
      shopId: shop.id,
      startsAt: slotDate3,
      capacity: 2,
      booked: 1,
    },
  });

  // 4. Job 1: ASSIGNED
  const booking1 = await prisma.booking.upsert({
    where: { id: "book_tech_assigned_001" },
    update: {
      status: "ASSIGNED",
      technicianId: tech.id,
    },
    create: {
      id: "book_tech_assigned_001",
      shopId: shop.id,
      customerId: customer.id,
      vehicleId: vehicle1.id,
      slotId: slot1.id,
      status: "ASSIGNED",
      technicianId: tech.id,
      customerNotes: "Squealing sound from front wheels under moderate braking. Customer requests pad inspection.",
    },
  });

  await prisma.bookingHistory.upsert({
    where: { id: "hist_tech_assigned_001" },
    update: {},
    create: {
      id: "hist_tech_assigned_001",
      bookingId: booking1.id,
      fromStatus: "CONFIRMED",
      toStatus: "ASSIGNED",
      actorId: sa.id,
      note: "Assigned to Demo Technician for comprehensive diagnostic inspection.",
    },
  });

  // 5. Job 2: INSPECTING
  const booking2 = await prisma.booking.upsert({
    where: { id: "book_tech_inspecting_002" },
    update: {
      status: "INSPECTING",
      technicianId: tech.id,
    },
    create: {
      id: "book_tech_inspecting_002",
      shopId: shop.id,
      customerId: customer.id,
      vehicleId: vehicle2.id,
      slotId: slot2.id,
      status: "INSPECTING",
      technicianId: tech.id,
      customerNotes: "Periodic 50,000 km scheduled maintenance, engine tune-up, and fluid level diagnostic.",
    },
  });

  await prisma.bookingHistory.upsert({
    where: { id: "hist_tech_inspecting_002" },
    update: {},
    create: {
      id: "hist_tech_inspecting_002",
      bookingId: booking2.id,
      fromStatus: "ASSIGNED",
      toStatus: "INSPECTING",
      actorId: tech.id,
      note: "Vehicle placed on lift. Inspection started.",
    },
  });

  // 6. Job 3: IN_REPAIR with returned QC issue
  const booking3 = await prisma.booking.upsert({
    where: { id: "book_tech_in_repair_003" },
    update: {
      status: "IN_REPAIR",
      technicianId: tech.id,
      qcInspectorId: null,
    },
    create: {
      id: "book_tech_in_repair_003",
      shopId: shop.id,
      customerId: customer.id,
      vehicleId: vehicle3.id,
      slotId: slot3.id,
      status: "IN_REPAIR",
      technicianId: tech.id,
      customerNotes: "High-speed brake vibration and pulsation felt through steering wheel.",
    },
  });

  await prisma.bookingHistory.upsert({
    where: { id: "hist_tech_in_repair_003_qc" },
    update: {},
    create: {
      id: "hist_tech_in_repair_003_qc",
      bookingId: booking3.id,
      fromStatus: "QC_IN_PROGRESS",
      toStatus: "IN_REPAIR",
      actorId: qc.id,
      note: "Quality control check failed: Front disc runout exceeds tolerance.",
    },
  });

  // Upsert QC issue for booking 3
  await prisma.qcIssue.upsert({
    where: { id: "qc_issue_demo_001" },
    update: {
      title: "Front Brake Rotor Runout Exceeds Tolerance",
      description: "Front passenger brake disc has 0.15mm lateral runout causing pedal pulsation. Rotor re-facing or replacement required.",
    },
    create: {
      id: "qc_issue_demo_001",
      bookingId: booking3.id,
      raisedById: qc.id,
      title: "Front Brake Rotor Runout Exceeds Tolerance",
      description: "Front passenger brake disc has 0.15mm lateral runout causing pedal pulsation. Rotor re-facing or replacement required.",
    },
  });

  console.log("✅ Technician scenario seed completed successfully!");
}
