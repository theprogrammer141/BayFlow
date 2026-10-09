import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { UpdateShopRequestSchema } from "@/lib/contracts/shop";
import { requireShopOwner, updateShop } from "@/lib/services/shops";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const shop = await requireShopOwner(authUser, params.shopId);
    return shop;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);

export const PATCH = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const updated = await updateShop(authUser, params.shopId, body);
    return updated;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: UpdateShopRequestSchema,
    },
  }
);
