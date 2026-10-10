import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { ReceivePurchaseOrderRequestSchema } from "@/lib/contracts/inventory";
import { receivePurchaseOrder } from "@/lib/services/inventory";

const ParamsSchema = z.object({ shopId: z.string().min(1), id: z.string().min(1) });

export const POST = handle(
  async ({ user, params, body }) => receivePurchaseOrder(requireAuth(user), params.shopId, params.id, body),
  { requireAuth: true, schema: { params: ParamsSchema, body: ReceivePurchaseOrderRequestSchema } }
);
