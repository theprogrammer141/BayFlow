import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getQcQueue } from "@/lib/services/qc";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const queue = await getQcQueue(authUser, params.shopId);
    return queue;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
