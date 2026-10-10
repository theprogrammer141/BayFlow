import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { receivePurchaseOrder } from "@/lib/services/purchase-orders";
import { ReceivePurchaseOrderRequestSchema } from "@/lib/contracts/inventory";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const order = await receivePurchaseOrder(
      authUser,
      params.shopId,
      params.id,
      body
    );
    return order;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: ReceivePurchaseOrderRequestSchema,
    },
  }
);
