import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import {
  getShopParts,
  createPart,
  updatePart,
} from "@/lib/services/parts";
import {
  CreatePartRequestSchema,
  UpdatePartRequestSchema,
} from "@/lib/contracts/inventory";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

const PatchPartBodySchema = UpdatePartRequestSchema.extend({
  id: z.string().optional(),
  partId: z.string().optional(),
}).refine((data) => Boolean(data.id || data.partId), {
  message: "Part ID is required in either id or partId",
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const parts = await getShopParts(authUser, params.shopId);
    return parts;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const part = await createPart(authUser, params.shopId, body);
    return part;
  },
  {
    requireAuth: true,
    status: 201,
    schema: {
      params: ParamsSchema,
      body: CreatePartRequestSchema,
    },
  }
);

export const PATCH = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const targetPartId = (body.id || body.partId)!;
    const part = await updatePart(authUser, params.shopId, targetPartId, body);
    return part;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: PatchPartBodySchema,
    },
  }
);
