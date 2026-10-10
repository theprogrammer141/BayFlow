import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import {
  getShopPartById,
  updatePart,
} from "@/lib/services/parts";
import { UpdatePartRequestSchema } from "@/lib/contracts/inventory";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  partId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const part = await getShopPartById(authUser, params.shopId, params.partId);
    return part;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);

export const PATCH = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const part = await updatePart(
      authUser,
      params.shopId,
      params.partId,
      body
    );
    return part;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: UpdatePartRequestSchema,
    },
  }
);
