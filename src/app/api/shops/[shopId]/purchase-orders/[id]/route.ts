import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getShopPurchaseOrderById } from "@/lib/services/purchase-orders";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const order = await getShopPurchaseOrderById(
      authUser,
      params.shopId,
      params.id
    );
    return order;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
