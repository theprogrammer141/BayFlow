import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { UpdatePartRequestSchema } from "@/lib/contracts/inventory";
import { updatePart } from "@/lib/services/inventory";

const ParamsSchema = z.object({ shopId: z.string().min(1), id: z.string().min(1) });

export const PATCH = handle(
  async ({ user, params, body }) => updatePart(requireAuth(user), params.shopId, params.id, body),
  { requireAuth: true, schema: { params: ParamsSchema, body: UpdatePartRequestSchema } }
);