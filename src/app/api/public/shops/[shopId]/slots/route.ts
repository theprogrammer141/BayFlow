import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { PublicSlotsQuerySchema } from "@/lib/contracts/public";
import { getPublicShopSlots } from "@/lib/services/slots";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ params, query }) => {
    return getPublicShopSlots(params.shopId, query.date);
  },
  {
    requireAuth: false,
    schema: {
      params: ParamsSchema,
      query: PublicSlotsQuerySchema,
    },
  }
);
