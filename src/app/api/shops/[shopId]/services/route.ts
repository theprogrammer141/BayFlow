import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { CreateServiceRequestSchema } from "@/lib/contracts/shop";
import { getShopServices, createShopService } from "@/lib/services/shops";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    return getShopServices(authUser, params.shopId);
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
    const service = await createShopService(authUser, params.shopId, body);
    return service;
  },
  {
    requireAuth: true,
    status: 201,
    schema: {
      params: ParamsSchema,
      body: CreateServiceRequestSchema,
    },
  }
);
