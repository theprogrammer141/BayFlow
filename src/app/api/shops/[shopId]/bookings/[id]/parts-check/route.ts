import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { checkBookingParts } from "@/lib/services/parts";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const result = await checkBookingParts(authUser, params.shopId, params.id);
    return result;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
