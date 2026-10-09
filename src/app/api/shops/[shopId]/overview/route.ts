import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getShopOverview } from "@/lib/services/shops";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const overview = await getShopOverview(authUser, params.shopId);
    return overview;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
