import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { passQcJob } from "@/lib/services/qc";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

const BodySchema = z
  .object({
    note: z.string().optional(),
  })
  .optional();

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const result = await passQcJob(authUser, params.shopId, params.id, body?.note);
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
