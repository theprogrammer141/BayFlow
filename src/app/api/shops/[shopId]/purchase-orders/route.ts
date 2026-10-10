import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { CreatePurchaseOrderRequestSchema } from "@/lib/contracts/inventory";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/services/inventory";

const ParamsSchema = z.object({ shopId: z.string().min(1) });

export const GET = handle(
  async ({ user, params }) => listPurchaseOrders(requireAuth(user), params.shopId),
  { requireAuth: true, schema: { params: ParamsSchema } }
);

export const POST = handle(
  async ({ user, params, body }) => createPurchaseOrder(requireAuth(user), params.shopId, body),
  { requireAuth: true, status: 201, schema: { params: ParamsSchema, body: CreatePurchaseOrderRequestSchema } }
);
