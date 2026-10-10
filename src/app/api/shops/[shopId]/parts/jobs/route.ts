import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getJobsAwaitingParts } from "@/lib/services/inventory";

const ParamsSchema = z.object({ shopId: z.string().min(1) });

export const GET = handle(
  async ({ user, params }) => getJobsAwaitingParts(requireAuth(user), params.shopId),
  { requireAuth: true, schema: { params: ParamsSchema } }
);
