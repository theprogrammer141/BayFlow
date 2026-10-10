import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import {
  getShopPurchaseOrders,
  createPurchaseOrder,
} from "@/lib/services/purchase-orders";
import { CreatePurchaseOrderRequestSchema } from "@/lib/contracts/inventory";
import { POStatusEnum } from "@/lib/contracts/common";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

const QuerySchema = z.object({
  status: POStatusEnum.optional(),
});

export const GET = handle(
  async ({ user, params, query }) => {
    const authUser = requireAuth(user);
    const orders = await getShopPurchaseOrders(
      authUser,
      params.shopId,
      query.status
    );
    return orders;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      query: QuerySchema,
    },
  }
);

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const order = await createPurchaseOrder(
      authUser,
      params.shopId,
      body
    );
    return order;
  },
  {
    requireAuth: true,
    status: 201,
    schema: {
      params: ParamsSchema,
      body: CreatePurchaseOrderRequestSchema,
    },
  }
);
