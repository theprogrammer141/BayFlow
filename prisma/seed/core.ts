import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seedCore(prisma: PrismaClient) {
  console.log("🌱 Seeding core backbone data...");

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Create Demo Owner
  const owner = await prisma.user.upsert({
    where: { email: "owner@bayflow.demo" },
    update: {},
    create: {
      name: "Demo Owner",
      email: "owner@bayflow.demo",
      phone: "+923001234567",
      passwordHash: defaultPasswordHash,
      isCustomer: false,
      isActive: true,
    },
  });

  // 2. Create Demo Shop
  const shop = await prisma.shop.upsert({
    where: { id: "shop_demo_001" },
    update: {},
    create: {
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

  // 3. Create Owner Membership
  await prisma.membership.upsert({
    where: {
      userId_shopId: {
        userId: owner.id,
        shopId: shop.id,
      },
    },
    update: {},
    create: {
      userId: owner.id,
      shopId: shop.id,
      role: "OWNER",
      isActive: true,
    },
  });

  // 4. Create Staff Members (SA, Tech, QC, Parts)
  const staffRoles = [
    { email: "sa@bayflow.demo", name: "Demo Service Advisor", role: "SERVICE_ADVISOR" as const },
    { email: "tech@bayflow.demo", name: "Demo Technician", role: "TECHNICIAN" as const },
    { email: "qc@bayflow.demo", name: "Demo QC Inspector", role: "QC_INSPECTOR" as const },
    { email: "parts@bayflow.demo", name: "Demo Parts Person", role: "PARTS_PERSON" as const },
  ];

  for (const staff of staffRoles) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: {},
      create: {
        name: staff.name,
        email: staff.email,
        phone: "+923000000000",
        passwordHash: defaultPasswordHash,
        isCustomer: false,
        isActive: true,
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_shopId: {
          userId: user.id,
          shopId: shop.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        shopId: shop.id,
        role: staff.role,
        isActive: true,
      },
    });
  }

  // 5. Create Demo Customer
  await prisma.user.upsert({
    where: { email: "customer@bayflow.demo" },
    update: {},
    create: {
      name: "Demo Customer",
      email: "customer@bayflow.demo",
      phone: "+923009999999",
      passwordHash: defaultPasswordHash,
      isCustomer: true,
      isActive: true,
    },
  });

  console.log("✅ Core backbone seed completed successfully!");
}
