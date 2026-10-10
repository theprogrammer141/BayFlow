import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { pickQcJob } from "@/lib/services/qc";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

const BodySchema = z.object({
  bookingId: z.string().min(1),
});

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const result = await pickQcJob(authUser, params.shopId, body.bookingId);
    return result;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: BodySchema,
    },
  }
);
