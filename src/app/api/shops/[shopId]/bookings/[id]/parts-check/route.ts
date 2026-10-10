import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getPartsCheck } from "@/lib/services/inventory";

const ParamsSchema = z.object({ shopId: z.string().min(1), id: z.string().min(1) });

export const GET = handle(
  async ({ user, params }) => getPartsCheck(requireAuth(user), params.shopId, params.id),
  { requireAuth: true, schema: { params: ParamsSchema } }
);
