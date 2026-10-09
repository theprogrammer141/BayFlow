import { handle } from "@/lib/api-handler";
import { PublicShopsQuerySchema } from "@/lib/contracts/public";
import { getPublicShops } from "@/lib/services/public";

export const GET = handle(
  async ({ query }) => {
    return getPublicShops(query);
  },
  {
    requireAuth: false,
    schema: {
      query: PublicShopsQuerySchema,
    },
  }
);
