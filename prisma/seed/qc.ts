import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seedQc(prisma: PrismaClient) {
  console.log("🌱 Seeding QC queue and inspection scenario data...");

  const shop = await prisma.shop.findUnique({
    where: { id: "shop_demo_001" },
  });

  if (!shop) {
    console.warn("⚠️ Demo shop not found. Please run core seed first.");
    return;
  }

  const qc = await prisma.user.findUnique({
    where: { email: "qc@bayflow.demo" },
  });
  const tech = await prisma.user.findUnique({
    where: { email: "tech@bayflow.demo" },
  });
  const customer = await prisma.user.findUnique({
    where: { email: "customer@bayflow.demo" },
  });

  if (!qc || !tech || !customer) {
    console.warn("⚠️ Missing required seed users for QC seed.");
    return;
  }

  // 1. Ensure slots exist for bookings
  let slot = await prisma.slot.findFirst({
    where: { shopId: shop.id },
  });

  if (!slot) {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    slot = await prisma.slot.create({
      data: {
        shopId: shop.id,
        startsAt: today,
        capacity: 10,
        booked: 0,
      },
    });
  }

  // 2. Ensure demo vehicles for QC bookings
  const vehiclePending = await prisma.vehicle.upsert({
    where: { id: "veh_demo_qc_pending" },
    update: {},
    create: {
      id: "veh_demo_qc_pending",
      ownerId: customer.id,
      regNo: "ICT-QC-101",
      make: "Toyota",
      model: "Corolla Altis Grande 1.8",
      year: 2022,
      color: "Phantom Brown",
      mileage: 42150,
    },
  });

  const vehicleInProgress = await prisma.vehicle.upsert({
    where: { id: "veh_demo_qc_in_progress" },
    update: {},
    create: {
      id: "veh_demo_qc_in_progress",
      ownerId: customer.id,
      regNo: "LHR-QC-202",
      make: "Honda",
      model: "Civic RS Turbo 1.5",
      year: 2023,
      color: "Meteoroid Gray",
      mileage: 18500,
    },
  });

  const vehicleLoop = await prisma.vehicle.upsert({
    where: { id: "veh_demo_qc_loop" },
    update: {},
    create: {
      id: "veh_demo_qc_loop",
      ownerId: customer.id,
      regNo: "KHI-QC-303",
      make: "Kia",
      model: "Sportage AWD 2.0",
      year: 2021,
      color: "Clear White",
      mileage: 56300,
    },
  });

  // 3. Ensure a service exists for line linking
  let brakeService = await prisma.service.findFirst({
    where: { shopId: shop.id },
  });

  if (!brakeService) {
    brakeService = await prisma.service.create({
      data: {
        shopId: shop.id,
        name: "Comprehensive Brake Overhaul",
        description: "Full pad and rotor inspection, replacement, and hydraulic bleeding",
        basePrice: 8500,
        estMinutes: 90,
      },
    });
  }

  // 4. Booking in QC_PENDING (Awaiting QC Inspector to pick)
  const bookingPending = await prisma.booking.upsert({
    where: { id: "book_demo_qc_pending" },
    update: {
      status: "QC_PENDING",
      qcInspectorId: null,
      technicianId: tech.id,
    },
    create: {
      id: "book_demo_qc_pending",
      shopId: shop.id,
      customerId: customer.id,
      vehicleId: vehiclePending.id,
      slotId: slot.id,
      status: "QC_PENDING",
      technicianId: tech.id,
      customerNotes: "Customer reported squeaking noise when braking from high speeds.",
      services: {
        create: [
          {
            serviceId: brakeService.id,
            quantity: 1,
            unitPrice: 8500,
          },
        ],
      },
      estimate: {
        create: {
          revision: 1,
          total: 13000,
          items: {
            create: [
              {
                type: "PART",
                name: "Ceramic Brake Pads (Front)",
                quantity: 1,
                unitCost: 4500,
              },
              {
                type: "LABOUR",
                name: "Rotor Skimming & Pad Installation Labour",
                quantity: 1,
                unitCost: 8500,
              },
            ],
          },
        },
      },
      history: {
        create: [
          { fromStatus: null, toStatus: "PENDING", actorId: customer.id, note: "Online booking submitted" },
          { fromStatus: "PENDING", toStatus: "CONFIRMED", actorId: shop.ownerId, note: "Confirmed by SA" },
          { fromStatus: "CONFIRMED", toStatus: "ASSIGNED", actorId: shop.ownerId, note: "Assigned to lead technician" },
          { fromStatus: "ASSIGNED", toStatus: "INSPECTING", actorId: tech.id, note: "Initial inspection" },
          { fromStatus: "INSPECTING", toStatus: "ESTIMATE_REVIEW", actorId: tech.id, note: "Estimate drafted" },
          { fromStatus: "ESTIMATE_REVIEW", toStatus: "AWAITING_CUSTOMER", actorId: shop.ownerId, note: "Sent to customer" },
          { fromStatus: "AWAITING_CUSTOMER", toStatus: "ESTIMATE_APPROVED", actorId: customer.id, note: "Customer approved" },
          { fromStatus: "ESTIMATE_APPROVED", toStatus: "PARTS_READY", actorId: shop.ownerId, note: "Stock verified" },
          { fromStatus: "PARTS_READY", toStatus: "IN_REPAIR", actorId: shop.ownerId, note: "Repairs started" },
          { fromStatus: "IN_REPAIR", toStatus: "QC_PENDING", actorId: tech.id, note: "Repairs complete; sent to QC queue" },
        ],
      },
    },
  });

  // 5. Booking in QC_IN_PROGRESS (Currently picked by Demo QC Inspector)
  const bookingInProgress = await prisma.booking.upsert({
    where: { id: "book_demo_qc_in_progress" },
    update: {
      status: "QC_IN_PROGRESS",
      qcInspectorId: qc.id,
      technicianId: tech.id,
    },
    create: {
      id: "book_demo_qc_in_progress",
      shopId: shop.id,
      customerId: customer.id,
      vehicleId: vehicleInProgress.id,
      slotId: slot.id,
      status: "QC_IN_PROGRESS",
      technicianId: tech.id,
      qcInspectorId: qc.id,
      customerNotes: "Rough idling and check engine light illuminated on dashboard.",
      services: {
        create: [
          {
            serviceId: brakeService.id,
            quantity: 1,
            unitPrice: 12000,
          },
        ],
      },
      estimate: {
        create: {
          revision: 1,
          total: 17800,
          items: {
            create: [
              {
                type: "PART",
                name: "Iridium Spark Plugs (Set of 4)",
                quantity: 1,
                unitCost: 5800,
              },
              {
                type: "LABOUR",
                name: "Ignition System Diagnostic & Calibration",
                quantity: 1,
                unitCost: 12000,
              },
            ],
          },
        },
      },
      history: {
        create: [
          { fromStatus: null, toStatus: "PENDING", actorId: customer.id, note: "Submitted online" },
          { fromStatus: "PENDING", toStatus: "CONFIRMED", actorId: shop.ownerId },
          { fromStatus: "CONFIRMED", toStatus: "ASSIGNED", actorId: shop.ownerId },
          { fromStatus: "ASSIGNED", toStatus: "IN_REPAIR", actorId: tech.id },
          { fromStatus: "IN_REPAIR", toStatus: "QC_PENDING", actorId: tech.id, note: "Repairs completed by technician" },
          { fromStatus: "QC_PENDING", toStatus: "QC_IN_PROGRESS", actorId: qc.id, note: "Picked up by Demo QC Inspector" },
        ],
      },
    },
  });

  // 6. Booking illustrating the QC Failure Loop (Failed QC -> Re-repaired -> Back in QC_PENDING)
  const bookingLoop = await prisma.booking.upsert({
    where: { id: "book_demo_qc_loop" },
    update: {
      status: "QC_PENDING",
      qcInspectorId: null,
      technicianId: tech.id,
    },
    create: {
      id: "book_demo_qc_loop",
      shopId: shop.id,
      customerId: customer.id,
      vehicleId: vehicleLoop.id,
      slotId: slot.id,
      status: "QC_PENDING",
      technicianId: tech.id,
      customerNotes: "AC cooling deficient and strange vibration from front suspension.",
      services: {
        create: [
          {
            serviceId: brakeService.id,
            quantity: 1,
            unitPrice: 15000,
          },
        ],
      },
      estimate: {
        create: {
          revision: 1,
          total: 19500,
          items: {
            create: [
              {
                type: "PART",
                name: "Silicone Wiper Set & Cabin Filter",
                quantity: 1,
                unitCost: 4500,
              },
              {
                type: "LABOUR",
                name: "Suspension Linkage Tightening & Alignment",
                quantity: 1,
                unitCost: 15000,
              },
            ],
          },
        },
      },
      history: {
        create: [
          { fromStatus: "IN_REPAIR", toStatus: "QC_PENDING", actorId: tech.id, note: "First repair round done" },
          { fromStatus: "QC_PENDING", toStatus: "QC_IN_PROGRESS", actorId: qc.id, note: "Picked for initial test" },
          { fromStatus: "QC_IN_PROGRESS", toStatus: "IN_REPAIR", actorId: qc.id, note: "QC Failed: Suspension sway bar linkage torque out of spec" },
          { fromStatus: "IN_REPAIR", toStatus: "QC_PENDING", actorId: tech.id, note: "Linkage re-torqued and tested; resubmitted to QC" },
        ],
      },
      qcIssues: {
        create: [
          {
            title: "Suspension sway bar linkage torque out of spec",
            description: "Front left sway bar end-link nut was loose (torqued to only 30 Nm instead of spec 65 Nm). Knocking sound audible during obstacle ramp test.",
            raisedById: qc.id,
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded QC scenario bookings: ${bookingPending.id}, ${bookingInProgress.id}, ${bookingLoop.id}`);
}
