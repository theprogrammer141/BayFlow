import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { failQcJob } from "@/lib/services/qc";
import { QcFailRequestSchema } from "@/lib/contracts/qc";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

const BodySchema = QcFailRequestSchema.extend({
  note: z.string().optional(),
});

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const result = await failQcJob(authUser, params.shopId, params.id, body);
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
