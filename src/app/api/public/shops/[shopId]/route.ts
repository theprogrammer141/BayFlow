import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { getPublicShopById } from "@/lib/services/public";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ params }) => {
    return getPublicShopById(params.shopId);
  },
  {
    requireAuth: false,
    schema: {
      params: ParamsSchema,
    },
  }
);
