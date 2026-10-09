import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { UpdateServiceRequestSchema } from "@/lib/contracts/shop";
import { updateShopService } from "@/lib/services/shops";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  serviceId: z.string().min(1),
});

export const PATCH = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const updated = await updateShopService(
      authUser,
      params.shopId,
      params.serviceId,
      body
    );
    return updated;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: UpdateServiceRequestSchema,
    },
  }
);
