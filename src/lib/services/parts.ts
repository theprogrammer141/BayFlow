import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenancy/membership";
import type { AuthUser } from "@/lib/auth/types";

export interface ShopPartItem {
  id: string;
  shopId: string;
  sku: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  cost: number;
}

export async function getShopParts(
  actor: AuthUser,
  shopId: string
): Promise<ShopPartItem[]> {
  requireMembership(actor, shopId, [
    "PARTS_PERSON",
    "TECHNICIAN",
    "SERVICE_ADVISOR",
    "OWNER",
  ]);

  return db.part.findMany({
    where: { shopId },
    orderBy: { name: "asc" },
  });
}
