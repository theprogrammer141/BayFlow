import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { SaveEstimateRequestSchema } from "@/lib/contracts/estimate";
import { getBookingEstimate, saveBookingEstimate } from "@/lib/services/estimate";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const estimate = await getBookingEstimate(
      authUser,
      params.shopId,
      params.id
    );
    return estimate;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);

export const PUT = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const updated = await saveBookingEstimate(
      authUser,
      params.shopId,
      params.id,
      body
    );
    return updated;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: SaveEstimateRequestSchema,
    },
  }
);
