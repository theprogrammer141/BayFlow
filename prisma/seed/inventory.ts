import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seedInventory(prisma: PrismaClient) {
  console.log("🌱 Seeding inventory, purchase orders, and parts workflow data...");

  const shop = await prisma.shop.findUnique({
    where: { id: "shop_demo_001" },
  });

  if (!shop) {
    console.warn("⚠️ Demo shop not found. Please run core seed first.");
    return;
  }

  const partsUser = await prisma.user.findUnique({
    where: { email: "parts@bayflow.demo" },
  });
  const techUser = await prisma.user.findUnique({
    where: { email: "tech@bayflow.demo" },
  });
  const customer = await prisma.user.findUnique({
    where: { email: "customer@bayflow.demo" },
  });

  if (!partsUser || !techUser || !customer) {
    console.warn("⚠️ Missing required seed users for inventory seed.");
    return;
  }

  // 1. Seed complete inventory catalog
  const catalogParts = [
    { sku: "BRK-PAD-001", name: "Ceramic Brake Pads (Front Set)", cost: 4500, quantity: 14, reorderLevel: 4 },
    { sku: "BRK-PAD-002", name: "Metallic Brake Pads (Rear Set)", cost: 3800, quantity: 3, reorderLevel: 5 }, // Low stock
    { sku: "BRK-ROT-001", name: "Ventilated Front Brake Rotor Disc", cost: 8500, quantity: 6, reorderLevel: 2 },
    { sku: "OIL-5W30-SYN", name: "Fully Synthetic Engine Oil 5W-30 (4L)", cost: 6500, quantity: 20, reorderLevel: 6 },
    { sku: "OIL-0W20-SYN", name: "Advanced Fuel-Economy 0W-20 (4L)", cost: 7200, quantity: 2, reorderLevel: 4 }, // Low stock
    { sku: "OIL-FLT-001", name: "High Performance Oil Filter Cartridge", cost: 1200, quantity: 25, reorderLevel: 8 },
    { sku: "AIR-FLT-001", name: "Engine Intake Air Filter Element", cost: 2200, quantity: 0, reorderLevel: 3 }, // Out of stock
    { sku: "CAB-FLT-001", name: "Activated Carbon Cabin Air Filter", cost: 1800, quantity: 1, reorderLevel: 3 }, // Low stock
    { sku: "SPK-PLG-IRID", name: "Laser Iridium Spark Plug (Pack of 4)", cost: 5800, quantity: 8, reorderLevel: 3 },
    { sku: "BAT-12V-60AH", name: "Maintenance-Free 12V 60Ah Battery", cost: 14500, quantity: 4, reorderLevel: 2 },
    { sku: "BLT-SERP-001", name: "Heavy Duty Serpentine Accessory Belt", cost: 3200, quantity: 0, reorderLevel: 2 }, // Out of stock
    { sku: "WPR-BLD-SET", name: "All-Weather Silicone Wiper Blades (Pair)", cost: 2500, quantity: 12, reorderLevel: 4 },
  ];

  const partRecords = new Map<string, { id: string; name: string; sku: string; quantity: number }>();

  for (const item of catalogParts) {
    const part = await prisma.part.upsert({
      where: {
        shopId_sku: {
          shopId: shop.id,
          sku: item.sku,
        },
      },
      update: {
        name: item.name,
        cost: item.cost,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
      },
      create: {
        shopId: shop.id,
        sku: item.sku,
        name: item.name,
        cost: item.cost,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
      },
    });
    partRecords.set(item.sku, part);
  }

  // 2. Seed a sample booking in PARTS_PENDING with a shortage
  const vehicle = await prisma.vehicle.findFirst({
    where: { ownerId: customer.id },
  });
  const slot = await prisma.slot.findFirst({
    where: { shopId: shop.id },
  });

  if (vehicle && slot) {
    const airFilter = partRecords.get("AIR-FLT-001");
    const oilFilter = partRecords.get("OIL-FLT-001");

    if (airFilter && oilFilter) {
      const pendingBooking = await prisma.booking.upsert({
        where: { id: "book_demo_parts_pending" },
        update: {
          status: "PARTS_PENDING",
          partsPersonId: partsUser.id,
          technicianId: techUser.id,
        },
        create: {
          id: "book_demo_parts_pending",
          shopId: shop.id,
          customerId: customer.id,
          vehicleId: vehicle.id,
          slotId: slot.id,
          status: "PARTS_PENDING",
          technicianId: techUser.id,
          partsPersonId: partsUser.id,
          customerNotes: "Major scheduled servicing: replace filters and spark plugs.",
        },
      });

      // Estimate requires 2x Air Filter (0 in stock -> shortage of 2) and 1x Oil Filter (25 in stock)
      await prisma.estimate.upsert({
        where: { bookingId: pendingBooking.id },
        update: {
          revision: 1,
          total: 10600,
          approvedAt: new Date(),
        },
        create: {
          bookingId: pendingBooking.id,
          revision: 1,
          total: 10600,
          approvedAt: new Date(),
          items: {
            create: [
              {
                type: "PART",
                name: "Engine Intake Air Filter Element",
                partId: airFilter.id,
                quantity: 2,
                unitCost: 2200,
              },
              {
                type: "PART",
                name: "High Performance Oil Filter Cartridge",
                partId: oilFilter.id,
                quantity: 1,
                unitCost: 1200,
              },
              {
                type: "LABOUR",
                name: "Filter Replacement & Intake Cleaning",
                quantity: 1,
                unitCost: 5000,
              },
            ],
          },
        },
      });
    }

    // 3. Seed a booking in PARTS_ORDERED with an active Purchase Order
    const serpBelt = partRecords.get("BLT-SERP-001");
    if (serpBelt) {
      const orderedBooking = await prisma.booking.upsert({
        where: { id: "book_demo_parts_ordered" },
        update: {
          status: "PARTS_ORDERED",
          partsPersonId: partsUser.id,
          technicianId: techUser.id,
        },
        create: {
          id: "book_demo_parts_ordered",
          shopId: shop.id,
          customerId: customer.id,
          vehicleId: vehicle.id,
          slotId: slot.id,
          status: "PARTS_ORDERED",
          technicianId: techUser.id,
          partsPersonId: partsUser.id,
          customerNotes: "Engine squealing on acceleration: belt replacement required.",
        },
      });

      await prisma.estimate.upsert({
        where: { bookingId: orderedBooking.id },
        update: {
          revision: 1,
          total: 7200,
          approvedAt: new Date(),
        },
        create: {
          bookingId: orderedBooking.id,
          revision: 1,
          total: 7200,
          approvedAt: new Date(),
          items: {
            create: [
              {
                type: "PART",
                name: "Heavy Duty Serpentine Accessory Belt",
                partId: serpBelt.id,
                quantity: 1,
                unitCost: 3200,
              },
              {
                type: "LABOUR",
                name: "Belt Tensioner Check & Belt Installation",
                quantity: 1,
                unitCost: 4000,
              },
            ],
          },
        },
      });

      // Existing Purchase Order for this booking
      await prisma.purchaseOrder.upsert({
        where: { id: "po_demo_ordered_001" },
        update: {
          status: "ORDERED",
        },
        create: {
          id: "po_demo_ordered_001",
          shopId: shop.id,
          status: "ORDERED",
          createdById: partsUser.id,
          items: {
            create: [
              {
                partId: serpBelt.id,
                bookingId: orderedBooking.id,
                qtyOrdered: 2,
                qtyReceived: 0,
              },
            ],
          },
        },
      });
    }

    // 4. Seed a booking in PARTS_READY ready for allocation to IN_REPAIR
    const brakePads = partRecords.get("BRK-PAD-001");
    if (brakePads) {
      const readyBooking = await prisma.booking.upsert({
        where: { id: "book_demo_parts_ready" },
        update: {
          status: "PARTS_READY",
          partsPersonId: partsUser.id,
          technicianId: techUser.id,
        },
        create: {
          id: "book_demo_parts_ready",
          shopId: shop.id,
          customerId: customer.id,
          vehicleId: vehicle.id,
          slotId: slot.id,
          status: "PARTS_READY",
          technicianId: techUser.id,
          partsPersonId: partsUser.id,
          customerNotes: "Front brakes grinding during deceleration.",
        },
      });

      await prisma.estimate.upsert({
        where: { bookingId: readyBooking.id },
        update: {
          revision: 1,
          total: 8000,
          approvedAt: new Date(),
        },
        create: {
          bookingId: readyBooking.id,
          revision: 1,
          total: 8000,
          approvedAt: new Date(),
          items: {
            create: [
              {
                type: "PART",
                name: "Ceramic Brake Pads (Front Set)",
                partId: brakePads.id,
                quantity: 1,
                unitCost: 4500,
              },
              {
                type: "LABOUR",
                name: "Brake Caliper Service & Pad Fitting",
                quantity: 1,
                unitCost: 3500,
              },
            ],
          },
        },
      });
    }
  }

  console.log("✅ Inventory, shortage scenarios, and purchase orders seeded successfully!");
}
