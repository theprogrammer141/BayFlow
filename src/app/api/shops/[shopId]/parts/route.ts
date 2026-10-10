import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getShopParts } from "@/lib/services/parts";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const parts = await getShopParts(authUser, params.shopId);
    return parts;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
