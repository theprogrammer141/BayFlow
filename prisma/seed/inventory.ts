import type { PrismaClient } from "@/generated/prisma/client";

export async function seedInventory(prisma: PrismaClient, shopId: string) {
  const parts = await Promise.all([
    prisma.part.upsert({
      where: { shopId_sku: { shopId, sku: "BP-TY-001" } },
      update: {},
      create: { shopId, sku: "BP-TY-001", name: "Ceramic Brake Pad Set", quantity: 8, reorderLevel: 3, cost: 14500 },
    }),
    prisma.part.upsert({
      where: { shopId_sku: { shopId, sku: "OIL-SYN-5W30" } },
      update: {},
      create: { shopId, sku: "OIL-SYN-5W30", name: "Synthetic Engine Oil 5W-30", quantity: 15, reorderLevel: 5, cost: 9500 },
    }),
  ]);
  return parts;
}
