import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { CreateShopRequestSchema } from "@/lib/contracts/shop";
import { getOwnerShops, createShop } from "@/lib/services/shops";

export const GET = handle(
  async ({ user }) => {
    const authUser = requireAuth(user);
    return getOwnerShops(authUser);
  },
  { requireAuth: true }
);

export const POST = handle(
  async ({ user, body }) => {
    const authUser = requireAuth(user);
    const shop = await createShop(authUser, body);
    return shop;
  },
  {
    requireAuth: true,
    status: 201,
    schema: {
      body: CreateShopRequestSchema,
    },
  }
);
